const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const clientNoteRepository = require('../repositories/clientNote.repository');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const bookingAction = require('./bookingAction.service');
const ratingService = require('./rating.service');
const availabilityService = require('./availability.service');
const { forInstructor, historyEntry, toMoney } = require('./bookingView');
const { dayBounds, dateRange, localParts, zonedDateTime, addDays } = require('../utils/timezone');

const UPCOMING_DAYS = 7;

const scopeOf = (actor) => ({ instructorId: actor.id });

const notCancelled = (b) => b.status !== 'CANCELLED';

const dashboard = async (actor) => {
  const now = new Date();
  const tz = config.timezone;
  const day = dayBounds(now, tz);
  const upcomingEnd = zonedDateTime(addDays(localParts(now, tz).date, UPCOMING_DAYS + 1), 0, tz);

  const [today, upcoming, awaitingConfirmation, needsCompletion, cash, rating] = await Promise.all([
    bookingRepository.listAll({ instructorId: actor.id, range: { gte: day.start, lt: day.end } }),
    bookingRepository.listAll({ instructorId: actor.id, range: { gte: day.end, lt: upcomingEnd } }),
    bookingRepository.countWhere({ instructorId: actor.id, status: 'PENDING' }),
    bookingRepository.countWhere({ instructorId: actor.id, status: 'CONFIRMED', scheduledAt: { lt: now } }),
    paymentRepository.sumRecordedBetween(actor.id, day.start, day.end),
    ratingService.summaryFor(actor.id),
  ]);

  const todayRows = today.filter(notCancelled).map(forInstructor);
  const cashToCollectToday = todayRows.filter(
    (b) => ['CONFIRMED', 'COMPLETED'].includes(b.status) && b.paymentStatus === 'AWAITING_CASH',
  ).length;

  return {
    today: todayRows,
    upcoming: upcoming.filter(notCancelled).map(forInstructor),
    counts: { awaitingConfirmation, cashToCollectToday, needsCompletion },
    cashToday: { amount: toMoney(cash.amount || 0), count: cash.count, currency: 'PHP' },
    rating,
  };
};

const listBookings = async (actor, { page, limit, status, from, to }) => {
  const { rows, total } = await bookingRepository.list({
    page,
    limit,
    status,
    instructorId: actor.id,
    range: dateRange({ from, to }, config.timezone),
  });
  return { data: rows.map(forInstructor), meta: { page, limit, total } };
};

const getBooking = async (actor, id) => {
  const booking = await bookingRepository.findScoped(id, scopeOf(actor));
  if (!booking) throw bookingAction.notFound();
  return forInstructor(booking);
};

const history = async (actor, id) => (await bookingAction.history(id, scopeOf(actor))).map(historyEntry);

const act = async (kind, actor, id, meta, extra = {}) =>
  forInstructor(await bookingAction.run({ kind, bookingId: id, actor, scope: scopeOf(actor), meta, ...extra }));

const schedule = async (actor, { from, to }) => {
  const rows = await bookingRepository.listAll({
    instructorId: actor.id,
    range: dateRange({ from, to }, config.timezone),
  });
  return rows.map(forInstructor);
};

const slots = async (actor, { date, duration, bookingId }) => {
  let durationMinutes = duration || 60;
  if (bookingId) {
    const booking = await bookingRepository.findScoped(bookingId, scopeOf(actor));
    if (!booking) throw bookingAction.notFound();
    durationMinutes = booking.durationMinutes;
  }
  return availabilityService.listSlots({ instructorId: actor.id, date, durationMinutes, excludeId: bookingId });
};

const listClients = async (actor, { page, limit }) => {
  const groups = await bookingRepository.clientsOf(actor.id);
  const pageGroups = groups.slice((page - 1) * limit, page * limit);
  const users = await userRepository.findManyByIds(pageGroups.map((g) => g.clientId));
  const byId = new Map(users.map((u) => [u.id, u]));
  return {
    data: pageGroups.map((g) => {
      const u = byId.get(g.clientId);
      return {
        id: g.clientId,
        fullName: u ? u.fullName : null,
        phone: u ? u.phone : null,
        sessions: g._count._all,
        lastSessionAt: g._max.scheduledAt,
      };
    }),
    meta: { page, limit, total: groups.length },
  };
};

const requireMyClient = async (actor, clientId) => {
  if (!(await bookingRepository.hasClient(actor.id, clientId))) {
    throw AppError.notFound('CLIENT_NOT_FOUND', 'Client not found');
  }
};

const toNote = (n) => ({ id: n.id, note: n.note, createdAt: n.createdAt });

const getClient = async (actor, clientId) => {
  await requireMyClient(actor, clientId);
  const [[client], sessions, notes] = await Promise.all([
    userRepository.findManyByIds([clientId]),
    bookingRepository.listAll({ instructorId: actor.id, clientId }),
    clientNoteRepository.list(actor.id, clientId),
  ]);
  return {
    client: { id: client.id, fullName: client.fullName, phone: client.phone, email: client.email },
    sessions: sessions.reverse().map(forInstructor),
    notes: notes.map(toNote),
  };
};

const addNote = async (actor, clientId, { note }, meta) => {
  await requireMyClient(actor, clientId);
  const created = await prisma.$transaction(async (tx) => {
    const row = await clientNoteRepository.create({ instructorId: actor.id, clientId, note }, tx);
    await auditService.record(tx, {
      actor,
      action: 'CLIENT_NOTE_ADDED',
      targetType: 'CLIENT_NOTE',
      targetId: row.id,
      metadata: { clientId },
      meta,
    });
    return row;
  });
  return toNote(created);
};

module.exports = {
  dashboard,
  listBookings,
  getBooking,
  history,
  confirm: (actor, id, meta) => act('CONFIRM', actor, id, meta),
  reschedule: (actor, id, { scheduledAt, reason }, meta) => act('RESCHEDULE', actor, id, meta, { scheduledAt, reason }),
  complete: (actor, id, meta) => act('COMPLETE', actor, id, meta),
  noShow: (actor, id, meta) => act('NO_SHOW', actor, id, meta),
  cancel: (actor, id, { reason }, meta) => act('CANCEL', actor, id, meta, { reason }),
  schedule,
  slots,
  listClients,
  getClient,
  addNote,
};
