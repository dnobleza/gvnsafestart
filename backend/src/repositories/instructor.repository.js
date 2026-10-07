const prisma = require('../config/prisma');

const BRANCH = { select: { id: true, name: true } };
const WITH_BRANCH = { instructorProfile: { include: { branch: BRANCH } } };
const ROW_ONLY_BRANCH = { instructorProfile: { select: { branch: BRANCH } } };

const listInstructors = async ({ status, branchId, page, limit }) => {
  const where = { role: 'INSTRUCTOR' };
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;
  if (branchId) where.instructorProfile = { is: { branchId } };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: ROW_ONLY_BRANCH,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
};

const findInstructorById = async (id, client = prisma) => {
  const user = await client.user.findUnique({ where: { id }, include: WITH_BRANCH });
  return user && user.role === 'INSTRUCTOR' ? user : null;
};

const createInstructor = ({ user, profile }, client = prisma) =>
  client.user.create({
    data: { ...user, role: 'INSTRUCTOR', instructorProfile: { create: profile } },
    include: WITH_BRANCH,
  });

const updateProfile = (userId, data, client = prisma) =>
  client.instructorProfile.update({ where: { userId }, data });

const createProfile = (data, client = prisma) => client.instructorProfile.create({ data });

const findManyByIds = (ids) =>
  prisma.user.findMany({
    where: { id: { in: ids }, role: 'INSTRUCTOR' },
    include: ROW_ONLY_BRANCH,
    orderBy: { fullName: 'asc' },
  });

// Public-facing instructor list: only the branch is selected, never the
// instructor's home address.
const PUBLIC_SELECT = {
  id: true,
  fullName: true,
  instructorProfile: {
    select: { branch: { select: { id: true, name: true, latitude: true, longitude: true } } },
  },
};

const bookableWhere = ({ id, branchId, search } = {}) => ({
  role: 'INSTRUCTOR',
  isActive: true,
  instructorProfile: { is: { branch: { isActive: true }, ...(branchId ? { branchId } : {}) } },
  ...(id ? { id } : {}),
  ...(search ? { fullName: { contains: search, mode: 'insensitive' } } : {}),
});

const listBookable = (filters) =>
  prisma.user.findMany({
    where: bookableWhere(filters),
    select: PUBLIC_SELECT,
    orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
  });

const findBookable = (id) => prisma.user.findFirst({ where: bookableWhere({ id }), select: PUBLIC_SELECT });

module.exports = {
  listInstructors,
  findInstructorById,
  createInstructor,
  updateProfile,
  createProfile,
  findManyByIds,
  listBookable,
  findBookable,
};
