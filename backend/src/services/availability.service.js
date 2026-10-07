const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const availabilityRepository = require('../repositories/availability.repository');
const bookingRepository = require('../repositories/booking.repository');
const userRepository = require('../repositories/user.repository');
const auditService = require('./audit.service');
const { localParts, zonedDateTime, addDays, toMinutes, toHHMM } = require('../utils/timezone');

const SLOT_STEP_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

// instructor_days_off.date is a DATE column; Prisma reads and writes it as UTC midnight.
const asDbDate = (isoDate) => new Date(`${isoDate}T00:00:00Z`);
const fromDbDate = (date) => date.toISOString().slice(0, 10);

const weekdayOf = (isoDate) => asDbDate(isoDate).getUTCDay();

const toWindow = (row) => ({ dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime });

const toDayOff = (row) => ({ id: row.id, date: fromDbDate(row.date), reason: row.reason });

const today = () => localParts(new Date(), config.timezone).date;

// Runs inside the caller's transaction. The instructor row lock makes every
// booking write for that instructor queue here, so the overlap check below
// cannot race a concurrent create or reschedule.
const assertSlotFree = async (tx, { instructorId, start, durationMinutes, excludeId }) => {
  await userRepository.lockUser(tx, instructorId);

  const end = new Date(start.getTime() + durationMinutes * 60000);
  const from = localParts(start, config.timezone);
  const to = localParts(end, config.timezone);
  let endMinutes = null;
  if (to.date === from.date) endMinutes = to.minutes;
  else if (to.date === addDays(from.date, 1) && to.minutes === 0) endMinutes = DAY_MINUTES;

  const windows = await availabilityRepository.listForDay(instructorId, from.dayOfWeek, tx);
  const fits =
    endMinutes !== null &&
    windows.some((w) => toMinutes(w.startTime) <= from.minutes && endMinutes <= toMinutes(w.endTime));
  if (!fits) {
    throw AppError.badRequest('OUTSIDE_AVAILABILITY', 'That time is outside the instructor\'s working hours');
  }

  if (await availabilityRepository.findDayOff(instructorId, asDbDate(from.date), tx)) {
    throw AppError.badRequest('INSTRUCTOR_DAY_OFF', 'The instructor is off on that day');
  }

  if (await bookingRepository.findOverlap(tx, { instructorId, start, end, excludeId })) {
    throw AppError.conflict('SLOT_TAKEN', 'That time overlaps another session');
  }
};

const listSlots = async ({ instructorId, date, durationMinutes, excludeId }) => {
  const tz = config.timezone;
  const [windows, dayOff] = await Promise.all([
    availabilityRepository.listForDay(instructorId, weekdayOf(date)),
    availabilityRepository.findDayOff(instructorId, asDbDate(date)),
  ]);
  if (dayOff) return { date, dayOff: true, slots: [] };

  const dayStart = zonedDateTime(date, 0, tz);
  const dayEnd = zonedDateTime(addDays(date, 1), 0, tz);
  const busy = (await bookingRepository.listBusy(instructorId, dayStart, dayEnd, excludeId)).map((b) => ({
    start: b.scheduledAt.getTime(),
    end: b.scheduledAt.getTime() + b.durationMinutes * 60000,
  }));

  const now = Date.now();
  const slots = [];
  for (const w of windows) {
    const close = toMinutes(w.endTime);
    for (let m = toMinutes(w.startTime); m + durationMinutes <= close; m += SLOT_STEP_MINUTES) {
      const start = zonedDateTime(date, m, tz).getTime();
      const end = start + durationMinutes * 60000;
      if (start <= now) continue;
      if (busy.some((b) => b.start < end && b.end > start)) continue;
      slots.push({ start: new Date(start).toISOString(), time: toHHMM(m) });
    }
  }
  return { date, dayOff: false, slots };
};

const getAvailability = async (instructorId) => {
  const [weekly, daysOff] = await Promise.all([
    availabilityRepository.listWeekly(instructorId),
    availabilityRepository.listDaysOff(instructorId, asDbDate(today())),
  ]);
  return { weekly: weekly.map(toWindow), daysOff: daysOff.map(toDayOff) };
};

const replaceWeekly = async (actor, windows, meta) => {
  await prisma.$transaction(async (tx) => {
    await availabilityRepository.replaceWeekly(actor.id, windows, tx);
    await auditService.record(tx, {
      actor,
      action: 'AVAILABILITY_UPDATED',
      targetType: 'INSTRUCTOR',
      targetId: actor.id,
      metadata: { windows },
      meta,
    });
  });
  return getAvailability(actor.id);
};

const addDayOff = async (actor, { date, reason }, meta) => {
  const created = await prisma.$transaction(async (tx) => {
    if (await availabilityRepository.findDayOff(actor.id, asDbDate(date), tx)) {
      throw AppError.conflict('DAY_OFF_EXISTS', 'That day is already marked off');
    }
    const row = await availabilityRepository.createDayOff(
      { instructorId: actor.id, date: asDbDate(date), reason: reason || null },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'DAY_OFF_ADDED',
      targetType: 'INSTRUCTOR_DAY_OFF',
      targetId: row.id,
      metadata: { date, reason: reason || null },
      meta,
    });
    return row;
  });
  return toDayOff(created);
};

const removeDayOff = async (actor, id, meta) => {
  await prisma.$transaction(async (tx) => {
    const row = await availabilityRepository.findDayOffScoped(id, actor.id, tx);
    if (!row) throw AppError.notFound('DAY_OFF_NOT_FOUND', 'Day off not found');
    await availabilityRepository.deleteDayOff(id, tx);
    await auditService.record(tx, {
      actor,
      action: 'DAY_OFF_REMOVED',
      targetType: 'INSTRUCTOR_DAY_OFF',
      targetId: id,
      metadata: { date: fromDbDate(row.date) },
      meta,
    });
  });
};

module.exports = { assertSlotFree, listSlots, getAvailability, replaceWeekly, addDayOff, removeDayOff };
