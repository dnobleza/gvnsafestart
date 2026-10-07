const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.rating.create({ data });

const findById = (id, client = prisma) => client.rating.findUnique({ where: { id } });

const findByBooking = (bookingId, client = prisma) => client.rating.findUnique({ where: { bookingId } });

const starCounts = (instructorIds) =>
  prisma.rating.groupBy({
    by: ['instructorId', 'stars'],
    where: { instructorId: { in: instructorIds }, excludedAt: null },
    _count: { _all: true },
  });

// Comments an admin hid are left out entirely; the summary counts them separately.
const listForInstructor = async ({ instructorId, page, limit }) => {
  const where = { instructorId, isHidden: false };
  const [rows, total] = await Promise.all([
    prisma.rating.findMany({
      where,
      select: { id: true, stars: true, comment: true, createdAt: true, booking: { select: { scheduledAt: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rating.count({ where }),
  ]);
  return { rows, total };
};

const buildAdminWhere = ({ instructorId, branchId }) => {
  const where = {};
  if (instructorId) where.instructorId = instructorId;
  if (branchId) where.instructor = { instructorProfile: { branchId } };
  return where;
};

const listForAdmin = async ({ page, limit, ...filters }) => {
  const where = buildAdminWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.rating.findMany({
      where,
      include: {
        client: { select: { id: true, fullName: true } },
        instructor: {
          select: {
            id: true,
            fullName: true,
            instructorProfile: { select: { branch: { select: { id: true, name: true } } } },
          },
        },
        booking: { select: { id: true, scheduledAt: true, lessonType: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.rating.count({ where }),
  ]);
  return { rows, total };
};

const instructorIdsWithRatings = async (filters) =>
  (
    await prisma.rating.groupBy({ by: ['instructorId'], where: buildAdminWhere(filters) })
  ).map((r) => r.instructorId);

// Active instructors with at least `minCount` ratings, best first.
const topRated = async ({ minCount }) => {
  const groups = await prisma.rating.groupBy({
    by: ['instructorId'],
    where: { instructor: { isActive: true, role: 'INSTRUCTOR' }, excludedAt: null },
    _avg: { stars: true },
    _count: { _all: true },
    having: { instructorId: { _count: { gte: minCount } } },
  });
  return groups
    .map((g) => ({ instructorId: g.instructorId, average: Number(g._avg.stars), count: g._count._all }))
    .sort((a, b) => b.average - a.average || b.count - a.count);
};

const latestVisibleComments = (instructorIds) =>
  prisma.rating.findMany({
    where: { instructorId: { in: instructorIds }, isHidden: false, comment: { not: null } },
    select: { instructorId: true, comment: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    distinct: ['instructorId'],
  });

const setHidden = (id, isHidden, client = prisma) =>
  client.rating.update({ where: { id }, data: { isHidden } });

// Hidden and out of every average, for a session that turned out not to happen.
const exclude = (id, client = prisma) =>
  client.rating.update({ where: { id }, data: { isHidden: true, excludedAt: new Date() } });

module.exports = {
  create,
  findById,
  findByBooking,
  starCounts,
  listForInstructor,
  topRated,
  latestVisibleComments,
  listForAdmin,
  instructorIdsWithRatings,
  setHidden,
  exclude,
};
