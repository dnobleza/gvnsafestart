const prisma = require('../config/prisma');
const { clientSearch } = require('./clientSearch');

const INCLUDE = {
  client: { select: { id: true, fullName: true, email: true } },
  booking: { select: { id: true, lessonType: true, scheduledAt: true } },
};

const buildWhere = ({ status, range, client } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (range && (range.gte || range.lt)) where.createdAt = range;
  if (client) where.client = clientSearch(client);
  return where;
};

const list = async ({ page, limit, ...filters }) => {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);
  return { rows, total };
};

const totalsByStatus = (filters) =>
  prisma.payment.groupBy({
    by: ['status'],
    where: buildWhere(filters),
    _count: { _all: true },
    _sum: { amount: true },
  });

const sumPaidBetween = async (start, end) => {
  const result = await prisma.payment.aggregate({
    where: { status: 'PAID', paidAt: { gte: start, lt: end } },
    _sum: { amount: true },
  });
  return result._sum.amount;
};

const countByStatus = (status) => prisma.payment.count({ where: { status } });

const create = (data, client = prisma) => client.payment.create({ data });

const findPaidForBooking = (bookingId, client = prisma) =>
  client.payment.findFirst({ where: { bookingId, status: 'PAID' } });

const findRecordedBy = (id, recordedById, client = prisma) =>
  client.payment.findFirst({ where: { id, recordedById } });

const CASH_INCLUDE = {
  client: { select: { id: true, fullName: true } },
  booking: { select: { id: true, lessonType: true, scheduledAt: true } },
  voidRequests: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { id: true, status: true, reason: true, createdAt: true, reviewedAt: true },
  },
};

const listRecordedBy = async ({ recordedById, page, limit, range }) => {
  const where = { recordedById };
  if (range && (range.gte || range.lt)) where.createdAt = range;
  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: CASH_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);
  return { rows, total };
};

const sumRecordedBetween = async (recordedById, start, end) => {
  const result = await prisma.payment.aggregate({
    where: { recordedById, status: 'PAID', paidAt: { gte: start, lt: end } },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return { amount: result._sum.amount, count: result._count._all };
};

const findOpenCheckout = (bookingId, provider, now, client = prisma) =>
  client.payment.findFirst({
    where: { bookingId, provider, status: 'PENDING', expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });

const findByProviderReference = (providerReference, client = prisma) =>
  client.payment.findUnique({ where: { providerReference } });

const markPaid = (id, client) => client.payment.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });

// Atomic per-year increment; the first payment of a year creates the row at 1.
const nextReceiptNumber = async (client, year) => {
  const [row] = await client.$queryRaw`
    INSERT INTO receipt_counters (year, last_number) VALUES (${year}, 1)
    ON CONFLICT (year) DO UPDATE SET last_number = receipt_counters.last_number + 1
    RETURNING last_number`;
  return Number(row.last_number);
};

const markVoided = (id, client) =>
  client.payment.update({ where: { id }, data: { status: 'VOIDED', voidedAt: new Date() } });

module.exports = {
  list,
  totalsByStatus,
  sumPaidBetween,
  countByStatus,
  create,
  findPaidForBooking,
  findRecordedBy,
  listRecordedBy,
  sumRecordedBetween,
  markVoided,
  nextReceiptNumber,
  findOpenCheckout,
  findByProviderReference,
  markPaid,
};
