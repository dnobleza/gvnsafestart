const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const ratingRepository = require('../repositories/rating.repository');
const instructorRepository = require('../repositories/instructor.repository');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const emailService = require('./email');
const topInstructors = require('./topInstructors.service');
const { branchOf } = require('./bookingView');

const MIN_RATINGS_FOR_AVERAGE = 3;
const RATING_WINDOW_DAYS = 14;
const DAY_MS = 86400000;

const emptyBreakdown = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

// Hidden comments still count: hiding only affects the text, never the stars.
const summarize = (breakdown) => {
  let count = 0;
  let sum = 0;
  for (const [stars, n] of Object.entries(breakdown)) {
    count += n;
    sum += Number(stars) * n;
  }
  const average = count ? Math.round((sum / count) * 10) / 10 : null;
  const isNew = count < MIN_RATINGS_FOR_AVERAGE;
  return { average: isNew ? null : average, count, isNew, display: isNew ? 'New' : average.toFixed(1), breakdown };
};

const summariesFor = async (instructorIds) => {
  const byInstructor = new Map(instructorIds.map((id) => [id, emptyBreakdown()]));
  if (instructorIds.length) {
    for (const row of await ratingRepository.starCounts(instructorIds)) {
      byInstructor.get(row.instructorId)[row.stars] = row._count._all;
    }
  }
  return new Map([...byInstructor].map(([id, breakdown]) => [id, summarize(breakdown)]));
};

const summaryFor = async (instructorId) => (await summariesFor([instructorId])).get(instructorId);

const ratingDeadline = (booking) => new Date(booking.scheduledAt.getTime() + RATING_WINDOW_DAYS * DAY_MS);

// Why a client can or cannot rate a booking right now, so the page can say so
// instead of silently hiding the form.
const ratingState = (booking, now = Date.now()) => {
  if (booking.rating) return 'RATED';
  if (['CANCELLED', 'NO_SHOW'].includes(booking.status) || !booking.instructorId) return 'NOT_APPLICABLE';
  if (booking.status !== 'COMPLETED') return 'NOT_YET';
  return now <= ratingDeadline(booking).getTime() ? 'OPEN' : 'EXPIRED';
};

const canRate = (booking, now = Date.now()) => ratingState(booking, now) === 'OPEN';

const MESSAGES = {
  notYet: 'You can rate after your session is completed',
  rated: 'You already rated this session',
  expired: 'The rating period has ended',
};

// The instructor's own view: the real average even below 3 ratings, a 5-to-1
// breakdown, and only comments the admin has not hidden. Hidden ratings still
// count in the summary. Never includes who wrote a rating.
const forInstructor = async (instructorId, { page, limit }) => {
  const [summary, { rows, total }] = await Promise.all([
    summaryFor(instructorId),
    ratingRepository.listForInstructor({ instructorId, page, limit }),
  ]);
  const sum = Object.entries(summary.breakdown).reduce((acc, [stars, n]) => acc + Number(stars) * n, 0);
  return {
    summary: {
      average: summary.count ? Math.round((sum / summary.count) * 10) / 10 : null,
      count: summary.count,
      isNew: summary.isNew,
      display: summary.display,
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: summary.breakdown[stars] })),
    },
    data: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      sessionDate: r.booking.scheduledAt,
      createdAt: r.createdAt,
    })),
    meta: { page, limit, total },
  };
};

const rate = async (actor, bookingId, { stars, comment }, meta) => {
  const { rating, emails } = await prisma.$transaction(async (tx) => {
    const booking = await bookingRepository.findScoped(bookingId, { clientId: actor.id }, tx);
    if (!booking) throw AppError.notFound('BOOKING_NOT_FOUND', 'Booking not found');
    if (booking.status !== 'COMPLETED' || !booking.instructorId) {
      throw AppError.badRequest('RATING_NOT_ALLOWED', MESSAGES.notYet);
    }
    if (booking.rating) throw AppError.conflict('ALREADY_RATED', MESSAGES.rated);
    if (Date.now() > ratingDeadline(booking).getTime()) {
      throw AppError.badRequest('RATING_WINDOW_CLOSED', MESSAGES.expired);
    }

    const created = await ratingRepository.create(
      {
        bookingId: booking.id,
        clientId: actor.id,
        instructorId: booking.instructorId,
        stars,
        comment: comment || null,
      },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'RATING_CREATED',
      targetType: 'RATING',
      targetId: created.id,
      metadata: { bookingId: booking.id, stars },
      meta,
    });
    const mails = await notificationService.notify(tx, [
      {
        user: booking.instructor,
        type: 'RATING_RECEIVED',
        title: 'New rating',
        message: `A client rated their ${booking.lessonType} lesson ${stars} out of 5.`,
        bookingId: booking.id,
      },
    ]);
    return { rating: created, emails: mails };
  });

  await emailService.sendAll(emails);
  topInstructors.clearCache();
  return { id: rating.id, stars: rating.stars, comment: rating.comment, createdAt: rating.createdAt };
};

const forAdmin = async ({ page, limit, instructorId, branchId }) => {
  const [{ rows, total }, ids] = await Promise.all([
    ratingRepository.listForAdmin({ page, limit, instructorId, branchId }),
    ratingRepository.instructorIdsWithRatings({ instructorId, branchId }),
  ]);
  const [summaries, instructors] = await Promise.all([summariesFor(ids), instructorRepository.findManyByIds(ids)]);

  return {
    data: rows.map((r) => ({
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      isHidden: r.isHidden,
      excluded: Boolean(r.excludedAt),
      createdAt: r.createdAt,
      client: r.client,
      instructor: { id: r.instructor.id, fullName: r.instructor.fullName, branch: branchOf(r.instructor) },
      booking: r.booking,
    })),
    instructors: instructors.map((i) => ({
      id: i.id,
      fullName: i.fullName,
      branch: branchOf(i),
      ...summaries.get(i.id),
    })),
    meta: { page, limit, total },
  };
};

const setHidden = async (actor, id, hidden, meta) => {
  const updated = await prisma.$transaction(async (tx) => {
    const rating = await ratingRepository.findById(id, tx);
    if (!rating) throw AppError.notFound('RATING_NOT_FOUND', 'Rating not found');
    const row = await ratingRepository.setHidden(id, hidden, tx);
    await auditService.record(tx, {
      actor,
      action: hidden ? 'RATING_HIDDEN' : 'RATING_UNHIDDEN',
      targetType: 'RATING',
      targetId: id,
      metadata: { instructorId: rating.instructorId, bookingId: rating.bookingId },
      meta,
    });
    return row;
  });
  topInstructors.clearCache();
  return { id: updated.id, isHidden: updated.isHidden };
};

module.exports = {
  MESSAGES,
  summaryFor,
  summariesFor,
  ratingState,
  canRate,
  ratingDeadline,
  forInstructor,
  rate,
  forAdmin,
  setHidden,
};
