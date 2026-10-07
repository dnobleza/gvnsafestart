const prisma = require('../config/prisma');

const WITH_COUNT = { _count: { select: { instructorProfiles: true } } };

const list = async ({ status, page, limit }) => {
  const where = {};
  if (status === 'active') where.isActive = true;
  if (status === 'inactive') where.isActive = false;

  const [rows, total] = await Promise.all([
    prisma.branch.findMany({
      where,
      include: WITH_COUNT,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.branch.count({ where }),
  ]);
  return { rows, total };
};

const listActiveOptions = () =>
  prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

const findById = (id, client = prisma) =>
  client.branch.findUnique({ where: { id }, include: WITH_COUNT });

const findByNameInsensitive = (name, client = prisma) =>
  client.branch.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });

const create = (data, client = prisma) => client.branch.create({ data, include: WITH_COUNT });

const update = (id, data, client = prisma) =>
  client.branch.update({ where: { id }, data, include: WITH_COUNT });

const listActiveLocated = () =>
  prisma.branch.findMany({
    where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, name: true, latitude: true, longitude: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

module.exports = { listActiveLocated, list, listActiveOptions, findById, findByNameInsensitive, create, update };
