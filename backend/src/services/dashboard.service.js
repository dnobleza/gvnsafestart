const config = require('../config');
const bookingRepository = require('../repositories/booking.repository');
const paymentRepository = require('../repositories/payment.repository');
const { dayBounds, monthBounds } = require('../utils/timezone');

const CURRENCY = 'PHP';

const overview = async () => {
  const now = new Date(Date.now());
  const day = dayBounds(now, config.timezone);
  const month = monthBounds(now, config.timezone);

  const [todaysBookings, revenue, pendingBookings, failedPayments] = await Promise.all([
    bookingRepository.countScheduledBetween(day.start, day.end),
    paymentRepository.sumPaidBetween(month.start, month.end),
    bookingRepository.countByStatus('PENDING'),
    paymentRepository.countByStatus('FAILED'),
  ]);

  return {
    todaysBookings,
    revenueThisMonth: { amount: (revenue || 0).toFixed(2), currency: CURRENCY },
    pendingBookings,
    failedPayments,
  };
};

module.exports = { overview };
