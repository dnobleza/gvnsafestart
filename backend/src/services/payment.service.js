const config = require('../config');
const paymentRepository = require('../repositories/payment.repository');
const { dateRange } = require('../utils/timezone');

const STATUSES = ['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'VOIDED'];

const money = (value) => (value === null || value === undefined ? '0.00' : value.toFixed(2));

const toRow = (payment) => ({
  id: payment.id,
  amount: money(payment.amount),
  currency: payment.currency,
  status: payment.status,
  method: payment.method,
  reference: payment.reference,
  paidAt: payment.paidAt,
  createdAt: payment.createdAt,
  client: {
    id: payment.client.id,
    fullName: payment.client.fullName,
    email: payment.client.email,
  },
  booking: payment.booking
    ? {
        id: payment.booking.id,
        lessonType: payment.booking.lessonType,
        scheduledAt: payment.booking.scheduledAt,
      }
    : null,
});

const buildTotals = (groups) => {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, { count: 0, amount: '0.00' }]));
  let count = 0;
  let cents = 0n;

  for (const group of groups) {
    const amount = money(group._sum.amount);
    byStatus[group.status] = { count: group._count._all, amount };
    count += group._count._all;
    cents += BigInt(amount.replace('.', ''));
  }

  const digits = cents.toString().padStart(3, '0');
  return {
    overall: { count, amount: `${digits.slice(0, -2)}.${digits.slice(-2)}` },
    byStatus,
  };
};

const list = async ({ page, limit, status, from, to, client }) => {
  const filters = { status, client, range: dateRange({ from, to }, config.timezone) };

  const [{ rows, total }, groups] = await Promise.all([
    paymentRepository.list({ page, limit, ...filters }),
    paymentRepository.totalsByStatus(filters),
  ]);

  return {
    data: rows.map(toRow),
    meta: { page, limit, total, totals: buildTotals(groups) },
  };
};

module.exports = { list };
