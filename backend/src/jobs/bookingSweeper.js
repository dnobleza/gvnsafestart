const logger = require('../config/logger');
const bookingRepository = require('../repositories/booking.repository');
const bookingAction = require('../services/bookingAction.service');
const settingsService = require('../services/settings.service');
const packageService = require('../services/package.service');

const INTERVAL_MS = 60000;
const HOUR_MS = 3600000;

const cancelAll = async (bookings, reason) => {
  let cancelled = 0;
  for (const booking of bookings) {
    try {
      await bookingAction.run({
        kind: 'CANCEL',
        bookingId: booking.id,
        actor: bookingAction.SYSTEM_ACTOR,
        scope: {},
        reason,
      });
      cancelled += 1;
    } catch (err) {
      // A booking the instructor or client changed in the meantime is simply skipped.
      logger.warn(`Sweeper skipped booking ${booking.id}: ${err.message}`);
    }
  }
  return cancelled;
};

// Cancels online bookings whose payment window has passed, and cash bookings
// still unconfirmed when the session is close. Each cancel goes through the
// normal booking engine, so history, audit and notifications are written.
const sweep = async (now = new Date()) => {
  const settings = await settingsService.get();
  // Packages first, so their sessions are cancelled with the package reason.
  const expiredPackages = await packageService.expireUnpaid(now);
  const [expiredOnline, staleCash] = await Promise.all([
    bookingRepository.findManyWhere({
      status: { in: bookingRepository.OPEN_STATUSES },
      paymentMethod: 'ONLINE',
      paymentStatus: 'UNPAID',
      paymentDueAt: { lt: now },
    }),
    bookingRepository.findManyWhere({
      status: 'PENDING',
      paymentMethod: 'CASH',
      paymentStatus: 'AWAITING_CASH',
      scheduledAt: { gt: now, lt: new Date(now.getTime() + settings.cashAutoCancelHours * HOUR_MS) },
    }),
  ]);

  return {
    expiredPackages,
    expiredOnline: await cancelAll(expiredOnline, 'Online payment was not completed in time'),
    staleCash: await cancelAll(
      staleCash,
      `Not confirmed ${settings.cashAutoCancelHours} hours before the session`,
    ),
  };
};

const start = () => {
  const timer = setInterval(() => {
    sweep().catch((err) => logger.error(`Booking sweeper failed: ${err.message}`));
  }, INTERVAL_MS);
  timer.unref();
  return timer;
};

module.exports = { sweep, start };
