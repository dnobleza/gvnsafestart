const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.user.create({ data });

const findById = (id, client = prisma) => client.user.findUnique({ where: { id } });

const findByEmail = (email) => prisma.user.findUnique({ where: { email } });

const findByPhone = (phone) => prisma.user.findUnique({ where: { phone } });

const findByProviderIdentity = async (provider, providerUserId) => {
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
    include: { user: true },
  });
  return identity ? identity.user : null;
};

const update = (id, data, client = prisma) => client.user.update({ where: { id }, data });

const findByRoleAndId = async (role, id, client = prisma) => {
  const user = await client.user.findUnique({ where: { id } });
  return user && user.role === role ? user : null;
};

const listByRole = async ({ role, status, page, limit }) => {
  const where = { role };
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return { rows, total };
};

const countActiveAdminsExcept = (excludeId, client = prisma) =>
  client.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: excludeId } } });

// Row locks on every active admin, held until the transaction ends. A second
// deactivation waits here, then counts what the first one committed, so two
// admins deactivating each other cannot both pass the last-admin check.
// ORDER BY id keeps the lock order fixed, so concurrent callers cannot deadlock.
const lockActiveAdmins = (client) =>
  client.$queryRaw`SELECT id FROM users WHERE role = 'ADMIN'::"UserRole" AND is_active = true ORDER BY id FOR UPDATE`;

// Serialises every booking write for one instructor, so two requests cannot
// both pass the overlap check and then both insert.
const lockUser = (client, id) => client.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;

const findActiveByRole = (role, client = prisma) =>
  client.user.findMany({ where: { role, isActive: true }, select: { id: true, fullName: true, email: true } });

const findManyByIds = (ids, client = prisma) =>
  client.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, fullName: true, email: true, phone: true },
  });

module.exports = {
  lockUser,
  findActiveByRole,
  findManyByIds,
  create,
  findById,
  findByEmail,
  findByPhone,
  findByProviderIdentity,
  update,
  findByRoleAndId,
  listByRole,
  countActiveAdminsExcept,
  lockActiveAdmins,
};
