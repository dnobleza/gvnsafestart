const prisma = require('../config/prisma');
const { clientSearch } = require('./clientSearch');

const PERSON = { select: { id: true, fullName: true, email: true, phone: true } };

const BOOKING_INCLUDE = {
  client: PERSON,
  instructor: {
    select: {
      id: true,
      fullName: true,
      email: true,
      instructorProfile: { select: { branch: { select: { id: true, name: true, latitude: true, longitude: true } } } },
    },
  },
  lastActionBy: { select: { id: true, fullName: true, role: true } },
  payments: {
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      method: true,
      reference: true,
      provider: true,
      paidAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
  history: {
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    include: { changedBy: { select: { id: true, fullName: true } } },
  },
  rating: { select: { id: true, stars: true } },
  clientPackage: {
    select: {
      id: true,
      packageName: true,
      sessionsTotal: true,
      trainingType: true,
      pickupAddress: true,
      paymentMethod: true,
      paymentStatus: true,
      price: true,
      amountPaid: true,
      status: true,
      serviceArea: { select: { id: true, name: true } },
    },
  },
};

const OPEN_STATUSES = ['PENDING', 'CONFIRMED'];

const buildWhere = ({ status, range, client, instructorId, clientId, branchId, actionBy } = {}) => {
  const where = {};
  if (status) where.status = status;
  if (range && (range.gte || range.lt)) where.scheduledAt = range;
  if (client) where.client = clientSearch(client);
  if (instructorId) where.instructorId = instructorId;
  if (clientId) where.clientId = clientId;
  if (branchId) where.instructor = { instructorProfile: { branchId } };
  if (actionBy) where.lastActionBy = { role: actionBy };
  return where;
};

const list = async ({ page, limit, order = 'desc', ...filters }) => {
  const where = buildWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: BOOKING_INCLUDE,
      orderBy: [{ scheduledAt: order }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);
  return { rows, total };
};

const listWhere = async ({ where, page, limit, orderBy }) => {
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({ where, include: BOOKING_INCLUDE, orderBy, skip: (page - 1) * limit, take: limit }),
    prisma.booking.count({ where }),
  ]);
  return { rows, total };
};

const findManyWhere = (where, { orderBy, take } = {}, client = prisma) =>
  client.booking.findMany({ where, include: BOOKING_INCLUDE, orderBy, take });

const listAll = (filters, client = prisma) =>
  client.booking.findMany({
    where: buildWhere(filters),
    include: BOOKING_INCLUDE,
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
  });

const findById = (id, client = prisma) =>
  client.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });

// Ownership is part of the lookup, so a booking that belongs to someone else
// reads exactly like one that does not exist.
const findScoped = (id, { instructorId, clientId } = {}, client = prisma) => {
  const where = { id };
  if (instructorId) where.instructorId = instructorId;
  if (clientId) where.clientId = clientId;
  return client.booking.findFirst({ where, include: BOOKING_INCLUDE });
};

const create = (data, client = prisma) => client.booking.create({ data, include: BOOKING_INCLUDE });

const update = (id, data, client = prisma) => client.booking.update({ where: { id }, data });

const updateByPackage = (clientPackageId, data, client = prisma) =>
  client.booking.updateMany({ where: { clientPackageId }, data });

const updateIfStatus = async (id, allowedStatuses, data, client = prisma) => {
  const { count } = await client.booking.updateMany({
    where: { id, status: { in: allowedStatuses } },
    data,
  });
  return count;
};

const findOverlap = async (client, { instructorId, start, end, excludeId }) => {
  const rows = await client.$queryRaw`
    SELECT id FROM bookings
    WHERE instructor_id = ${instructorId}::uuid
      AND status IN ('PENDING'::"BookingStatus", 'CONFIRMED'::"BookingStatus")
      AND id <> ${excludeId || '00000000-0000-0000-0000-000000000000'}::uuid
      AND scheduled_at < ${end}
      AND scheduled_at + (duration_minutes * interval '1 minute') > ${start}
    LIMIT 1`;
  return rows[0] || null;
};

const listBusy = (instructorId, start, end, excludeId, client = prisma) =>
  client.booking.findMany({
    where: {
      instructorId,
      status: { in: OPEN_STATUSES },
      scheduledAt: { gte: new Date(start.getTime() - 24 * 3600000), lt: end },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

const countScheduledBetween = (start, end) =>
  prisma.booking.count({
    where: { scheduledAt: { gte: start, lt: end }, status: { not: 'CANCELLED' } },
  });

const countByStatus = (status) => prisma.booking.count({ where: { status } });

const count = (filters) => prisma.booking.count({ where: buildWhere(filters) });

const countWhere = (where) => prisma.booking.count({ where });

const clientsOf = (instructorId) =>
  prisma.booking.groupBy({
    by: ['clientId'],
    where: { instructorId },
    _count: { _all: true },
    _max: { scheduledAt: true },
    orderBy: { _max: { scheduledAt: 'desc' } },
  });

const hasClient = async (instructorId, clientId) =>
  (await prisma.booking.count({ where: { instructorId, clientId } })) > 0;

module.exports = {
  OPEN_STATUSES,
  list,
  listAll,
  listWhere,
  findManyWhere,
  findById,
  findScoped,
  create,
  update,
  updateByPackage,
  updateIfStatus,
  findOverlap,
  listBusy,
  countScheduledBetween,
  countByStatus,
  count,
  countWhere,
  clientsOf,
  hasClient,
};
