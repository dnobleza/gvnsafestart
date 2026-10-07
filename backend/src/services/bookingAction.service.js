const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const bookingHistoryRepository = require('../repositories/bookingHistory.repository');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const availabilityService = require('./availability.service');
const notificationService = require('./notification.service');
const settingsService = require('./settings.service');
const emailService = require('./email');

const { OPEN_STATUSES } = bookingRepository;
const { formatWhen } = notificationService;

const KINDS = {
  CONFIRM: { action: 'CONFIRMED', from: ['PENDING'], to: 'CONFIRMED' },
  RESCHEDULE: { action: 'RESCHEDULED', from: OPEN_STATUSES },
  COMPLETE: { action: 'COMPLETED', from: ['CONFIRMED'], to: 'COMPLETED', afterStart: true },
  NO_SHOW: { action: 'NO_SHOW', from: ['CONFIRMED'], to: 'NO_SHOW', afterStart: true },
  CANCEL: { action: 'CANCELLED', from: OPEN_STATUSES, to: 'CANCELLED' },
};

const ACTOR_LABEL = { ADMIN: 'an admin', INSTRUCTOR: 'the instructor', CLIENT: 'the client', SYSTEM: 'the system' };

// Automatic changes (payment expiry, auto-cancel) are made by no user.
const SYSTEM_ACTOR = Object.freeze({ id: null, role: 'SYSTEM', email: 'system', fullName: 'System' });

const HOUR_MS = 3600000;

const CLIENT_LIMITED = ['CANCEL', 'RESCHEDULE'];

const assertClientCutoff = async (kind, actor, booking) => {
  if (actor.role !== 'CLIENT' || !CLIENT_LIMITED.includes(kind)) return;
  const { clientChangeCutoffHours } = await settingsService.get();
  if (booking.scheduledAt.getTime() - Date.now() < clientChangeCutoffHours * HOUR_MS) {
    throw AppError.badRequest(
      'CHANGE_WINDOW_CLOSED',
      `Bookings can only be changed up to ${clientChangeCutoffHours} hours before the session`,
    );
  }
};

const priceFor = (pricePerHour, durationMinutes) => ((Number(pricePerHour) * durationMinutes) / 60).toFixed(2);

const notFound = () => AppError.notFound('BOOKING_NOT_FOUND', 'Booking not found');

const invalidTransition = (status) =>
  AppError.badRequest(
    'INVALID_BOOKING_TRANSITION',
    `A ${status.toLowerCase().replace('_', '-')} booking cannot be changed this way`,
  );

const withReason = (text, reason) => (reason ? `${text} Reason: ${reason}` : text);

// Who hears about a change: the instructor for reschedules and cancellations
// made by someone else; the client for confirmations, reschedules and
// cancellations made by someone else. Nobody is told about their own action.
const messagesFor = (kind, before, after, actor, reason) => {
  const out = [];
  const lesson = after.lessonType;
  const when = formatWhen(after.scheduledAt);
  const moved = `from ${formatWhen(before.scheduledAt)} to ${when}`;
  const { client, instructor } = after;
  const toClient = (type, title, message) =>
    client.id !== actor.id && out.push({ user: client, type, title, message, bookingId: after.id });
  const toInstructor = (type, title, message) =>
    instructor &&
    instructor.id !== actor.id &&
    out.push({ user: instructor, type, title, message, bookingId: after.id });

  if (kind === 'CONFIRM') {
    toClient('BOOKING_CONFIRMED', 'Booking confirmed', `Your ${lesson} lesson on ${when} is confirmed.`);
  }
  if (kind === 'RESCHEDULE') {
    toClient(
      'BOOKING_RESCHEDULED',
      'Booking rescheduled',
      withReason(`Your ${lesson} lesson was moved ${moved}.`, reason),
    );
    toInstructor(
      'BOOKING_RESCHEDULED',
      'Booking rescheduled',
      withReason(`${client.fullName}'s ${lesson} lesson was moved ${moved} by ${ACTOR_LABEL[actor.role]}.`, reason),
    );
  }
  if (kind === 'CANCEL') {
    toClient(
      'BOOKING_CANCELLED',
      'Booking cancelled',
      withReason(`Your ${lesson} lesson on ${when} was cancelled.`, reason),
    );
    toInstructor(
      'BOOKING_CANCELLED',
      'Booking cancelled',
      withReason(`${client.fullName}'s ${lesson} lesson on ${when} was cancelled by ${ACTOR_LABEL[actor.role]}.`, reason),
    );
  }
  return out;
};

const addHistory = (tx, booking, actor, fields) =>
  bookingHistoryRepository.create(
    {
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: booking.status,
      changedById: actor.id,
      changedByRole: actor.role,
      ...fields,
    },
    tx,
  );

const touch = (tx, booking, actor, extra = {}) =>
  bookingRepository.updateIfStatus(
    booking.id,
    [booking.status],
    { lastActionById: actor.id, lastActionAt: new Date(), ...extra },
    tx,
  );

// The single write path for booking state. One transaction covers the status
// change, last-action stamp, history row, audit row and in-app notifications;
// emails go out only after it commits, and a failed email is logged, not thrown.
const run = async ({ kind, bookingId, actor, scope, reason, scheduledAt, meta }) => {
  const def = KINDS[kind];

  const { booking, emails } = await prisma.$transaction(async (tx) => {
    const before = await bookingRepository.findScoped(bookingId, scope, tx);
    if (!before) throw notFound();
    if (!def.from.includes(before.status)) throw invalidTransition(before.status);
    if (def.afterStart && Date.now() < before.scheduledAt.getTime()) {
      throw AppError.badRequest('SESSION_NOT_STARTED', 'This can only be done after the session start time');
    }
    await assertClientCutoff(kind, actor, before);

    const changes = { lastActionById: actor.id, lastActionAt: new Date() };
    if (def.to) changes.status = def.to;
    if (kind === 'CANCEL') changes.cancelReason = reason;
    if (kind === 'RESCHEDULE') {
      if (scheduledAt.getTime() === before.scheduledAt.getTime()) {
        throw AppError.badRequest('SAME_TIME', 'The new time is the same as the current one');
      }
      if (before.instructorId) {
        await availabilityService.assertSlotFree(tx, {
          instructorId: before.instructorId,
          start: scheduledAt,
          durationMinutes: before.durationMinutes,
          excludeId: before.id,
        });
      }
      changes.scheduledAt = scheduledAt;
    }

    const count = await bookingRepository.updateIfStatus(before.id, def.from, changes, tx);
    if (count === 0) throw invalidTransition(before.status);

    const rescheduled = kind === 'RESCHEDULE';
    await addHistory(tx, before, actor, {
      action: def.action,
      toStatus: def.to || before.status,
      oldScheduledAt: rescheduled ? before.scheduledAt : null,
      newScheduledAt: rescheduled ? scheduledAt : null,
      reason: reason || null,
    });

    await auditService.record(tx, {
      actor,
      action: `BOOKING_${def.action}`,
      targetType: 'BOOKING',
      targetId: before.id,
      metadata: rescheduled
        ? { from: before.scheduledAt.toISOString(), to: scheduledAt.toISOString(), reason }
        : { from: before.status, to: def.to, ...(reason ? { reason } : {}) },
      meta,
    });

    const after = await bookingRepository.findById(before.id, tx);
    const mails = await notificationService.notify(tx, messagesFor(kind, before, after, actor, reason));
    return { booking: after, emails: mails };
  });

  await emailService.sendAll(emails);
  return booking;
};

// Creates one booking inside the caller's transaction (slot lock, overlap
// check, history, audit, instructor notification) and returns the booking and
// the emails to send after commit. Package purchases reuse it so the package
// and its first session commit together.
const createInTx = async (
  tx,
  { actor, instructorId, scheduledAt, durationMinutes, lessonType, area, notes, paymentMethod = 'CASH', settings, packageFields },
) => {
  const online = paymentMethod === 'ONLINE';
  const instructor = await userRepository.findByRoleAndId('INSTRUCTOR', instructorId, tx);
  if (!instructor || !instructor.isActive) {
    throw AppError.notFound('INSTRUCTOR_NOT_FOUND', 'Instructor not found');
  }
  await availabilityService.assertSlotFree(tx, { instructorId, start: scheduledAt, durationMinutes });

  const created = await bookingRepository.create(
    {
      clientId: actor.id,
      instructorId,
      scheduledAt,
      durationMinutes,
      lessonType,
      area: area || null,
      notes: notes || null,
      status: 'PENDING',
      paymentMethod,
      paymentStatus: online ? 'UNPAID' : 'AWAITING_CASH',
      price: priceFor(settings.pricePerHour, durationMinutes),
      paymentDueAt: online ? new Date(Date.now() + settings.onlinePaymentExpiryMinutes * 60000) : null,
      lastActionById: actor.id,
      lastActionAt: new Date(),
      ...(packageFields || {}),
    },
    tx,
  );

  await addHistory(tx, created, actor, {
    action: 'CREATED',
    fromStatus: null,
    toStatus: 'PENDING',
    newScheduledAt: scheduledAt,
  });
  await auditService.record(tx, {
    actor,
    action: 'BOOKING_CREATED',
    targetType: 'BOOKING',
    targetId: created.id,
    metadata: {
      instructorId,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes,
      lessonType,
      paymentMethod,
      ...(packageFields ? { clientPackageId: packageFields.clientPackageId, sessionNumber: packageFields.sessionNumber } : {}),
    },
    meta: actor.meta,
  });

  const label = packageFields ? `${lessonType} session ${packageFields.sessionNumber}` : `a ${lessonType} lesson`;
  const mails = await notificationService.notify(tx, [
    {
      user: instructor,
      type: 'BOOKING_CREATED',
      title: 'New booking request',
      message: `${actor.fullName} booked ${label} on ${formatWhen(scheduledAt)}. Please confirm it.`,
      bookingId: created.id,
    },
  ]);
  return { booking: await bookingRepository.findById(created.id, tx), emails: mails };
};

const create = async ({ meta, ...input }) => {
  const settings = await settingsService.get();
  const { booking, emails } = await prisma.$transaction((tx) =>
    createInTx(tx, { ...input, actor: { ...input.actor, meta }, settings }),
  );
  await emailService.sendAll(emails);
  return booking;
};

const history = async (bookingId, scope) => {
  const booking = await bookingRepository.findScoped(bookingId, scope);
  if (!booking) throw notFound();
  return bookingHistoryRepository.listForBooking(bookingId);
};

module.exports = { KINDS, SYSTEM_ACTOR, run, create, createInTx, history, addHistory, touch, notFound, priceFor };
