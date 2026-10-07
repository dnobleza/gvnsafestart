const config = require('../config');
const logger = require('../config/logger');
const auditService = require('./audit.service');
const prisma = require('../config/prisma');
const bookingRepository = require('../repositories/booking.repository');
const cronRunRepository = require('../repositories/cronRun.repository');
const bookingAction = require('./bookingAction.service');
const notificationService = require('./notification.service');
const settingsService = require('./settings.service');
const emailService = require('./email');
const { isCashUnpaid } = require('./bookingView');

const JOB = 'auto-complete';
const SCHEDULE = '*/15 * * * *';
const INTERVAL_MS = 15 * 60000;
const BATCH_SIZE = 200;
const HOUR_MS = 3600000;
// Arbitrary but fixed: every instance must ask for the same advisory lock.
const LOCK_KEY = 4217001;
const AUTO_COMPLETE_REASON = 'Auto-completed after session end';
const PENDING_REASON = 'Not confirmed before session start';
// A full batch run can touch hundreds of rows, well past Prisma's 5 s default.
const TX_OPTIONS = { maxWait: 10000, timeout: 120000 };

const { SYSTEM_ACTOR } = bookingAction;

const completionMessages = (booking) => {
  const { client, instructor } = booking;
  const out = [
    {
      user: client,
      type: 'BOOKING_COMPLETED',
      title: `Your session with ${instructor.fullName} was marked completed.`,
      message: 'How was your session? Rate your instructor.',
      bookingId: booking.id,
    },
    {
      user: instructor,
      type: 'BOOKING_COMPLETED',
      title: `Your session with ${client.fullName} was marked completed.`,
      message: `Session with ${client.fullName} was marked completed.`,
      bookingId: booking.id,
    },
  ];
  if (isCashUnpaid(booking)) {
    out.push({
      user: instructor,
      type: 'CASH_NOT_RECORDED',
      title: 'Cash not recorded',
      message: `Cash not recorded for ${client.fullName}'s session.`,
      bookingId: booking.id,
    });
  }
  return out;
};

// Batches of BATCH_SIZE until nothing is left, all inside the caller's
// transaction. Rows are re-selected by status each time, so a second run (or
// a second pass) finds nothing it already handled.
const processDue = async (tx, { now, userId = null }) => {
  const { autoCompleteGraceHours } = await settingsService.get();
  const cutoff = new Date(now.getTime() - autoCompleteGraceHours * HOUR_MS);
  const result = { completed: 0, cancelled: 0, cashUnpaid: 0, emails: [] };

  for (;;) {
    const due = await bookingRepository.lockDueForCompletion(tx, { cutoff, userId, limit: BATCH_SIZE });
    for (const { id } of due) {
      const { booking, emails } = await bookingAction.runInTx(tx, {
        kind: 'COMPLETE',
        bookingId: id,
        actor: SYSTEM_ACTOR,
        scope: {},
        reason: AUTO_COMPLETE_REASON,
        changes: { autoCompleted: true, autoCompletedAt: now },
      });
      result.completed += 1;
      if (isCashUnpaid(booking)) result.cashUnpaid += 1;
      result.emails.push(...emails, ...(await notificationService.notify(tx, completionMessages(booking))));
    }
    if (due.length < BATCH_SIZE) break;
  }

  for (;;) {
    const stale = await bookingRepository.lockPendingPastStart(tx, { now, userId, limit: BATCH_SIZE });
    for (const { id } of stale) {
      const { emails } = await bookingAction.runInTx(tx, {
        kind: 'CANCEL',
        bookingId: id,
        actor: SYSTEM_ACTOR,
        scope: {},
        reason: PENDING_REASON,
      });
      result.cancelled += 1;
      result.emails.push(...emails);
    }
    if (stale.length < BATCH_SIZE) break;
  }

  return result;
};

const summary = (status, outcome, extra = {}) => ({
  status,
  completed: outcome ? outcome.completed : 0,
  cancelled: outcome ? outcome.cancelled : 0,
  cashUnpaid: outcome ? outcome.cashUnpaid : 0,
  ...extra,
});

// The scheduled, external and admin "Run now" entry point. One transaction,
// guarded by an advisory lock so only one instance processes at a time; every
// call is recorded in cron_runs. Never throws: a failure is logged and stored.
const runAutoComplete = async ({ now = new Date(), trigger = 'SCHEDULE' } = {}) => {
  const run = await cronRunRepository.create({ job: JOB, trigger, status: 'RUNNING', startedAt: new Date() });
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (!(await cronRunRepository.tryLock(tx, LOCK_KEY))) return null;
      return processDue(tx, { now });
    }, TX_OPTIONS);

    if (!outcome) {
      await cronRunRepository.finish(run.id, { status: 'SKIPPED' });
      return summary('SKIPPED', null, { runId: run.id });
    }
    await emailService.sendAll(outcome.emails);
    await cronRunRepository.finish(run.id, {
      status: 'SUCCESS',
      completedCount: outcome.completed,
      cancelledCount: outcome.cancelled,
      cashUnpaidCount: outcome.cashUnpaid,
    });
    return summary('SUCCESS', outcome, { runId: run.id });
  } catch (err) {
    logger.error(`Auto-complete run failed: ${err.message}`);
    await cronRunRepository.finish(run.id, { status: 'FAILED', error: err.message.slice(0, 1000) }).catch(() => {});
    return summary('FAILED', null, { runId: run.id, error: err.message });
  }
};

// Backup for when the scheduler is off or late: settles only this user's
// bookings before their dashboard loads. Not recorded, and a failure never
// blocks the dashboard.
const runForUser = async (userId, now = new Date()) => {
  try {
    const outcome = await prisma.$transaction((tx) => processDue(tx, { now, userId }), TX_OPTIONS);
    await emailService.sendAll(outcome.emails);
    return summary('SUCCESS', outcome);
  } catch (err) {
    logger.warn(`Auto-complete for user ${userId} skipped: ${err.message}`);
    return summary('FAILED', null);
  }
};

const nextRunAt = (now = new Date()) => new Date(Math.floor(now.getTime() / INTERVAL_MS) * INTERVAL_MS + INTERVAL_MS);

const toRun = (r) =>
  r && {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    completed: r.completedCount,
    cancelled: r.cancelledCount,
    cashUnpaid: r.cashUnpaidCount,
    error: r.error,
  };

const status = async (now = new Date()) => {
  const [settings, last] = await Promise.all([settingsService.get(), cronRunRepository.latest(JOB)]);
  return {
    enabled: config.cron.enabled,
    schedule: SCHEDULE,
    timezone: config.timezone,
    graceHours: settings.autoCompleteGraceHours,
    lastRun: toRun(last),
    nextRunAt: config.cron.enabled ? nextRunAt(now) : null,
  };
};

const listRuns = async ({ page, limit }) => {
  const { rows, total } = await cronRunRepository.list({ job: JOB, page, limit });
  return { data: rows.map(toRun), meta: { page, limit, total } };
};

const runNow = async (actor, meta) => {
  const result = await runAutoComplete({ trigger: 'ADMIN' });
  await auditService.record(prisma, {
    actor,
    action: 'AUTO_COMPLETE_RUN',
    targetType: 'CRON_RUN',
    targetId: result.runId,
    metadata: { status: result.status, completed: result.completed, cancelled: result.cancelled, cashUnpaid: result.cashUnpaid },
    meta,
  });
  return result;
};

module.exports = {
  status,
  listRuns,
  runNow,
  JOB,
  SCHEDULE,
  AUTO_COMPLETE_REASON,
  PENDING_REASON,
  processDue,
  runAutoComplete,
  runForUser,
  nextRunAt,
  toRun,
};
