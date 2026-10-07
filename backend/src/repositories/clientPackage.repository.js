const prisma = require('../config/prisma');

const INCLUDE = {
  serviceArea: { select: { id: true, name: true } },
  instructor: {
    select: {
      id: true,
      fullName: true,
      email: true,
      instructorProfile: { select: { branch: { select: { id: true, name: true } } } },
    },
  },
  client: { select: { id: true, fullName: true, email: true, phone: true } },
  bookings: {
    select: { id: true, status: true, scheduledAt: true, durationMinutes: true, sessionNumber: true },
    orderBy: [{ sessionNumber: 'asc' }, { scheduledAt: 'asc' }],
  },
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
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
};

const create = (data, client = prisma) => client.clientPackage.create({ data });

const findById = (id, client = prisma) => client.clientPackage.findUnique({ where: { id }, include: INCLUDE });

const findScoped = (id, clientId, client = prisma) =>
  client.clientPackage.findFirst({ where: { id, clientId }, include: INCLUDE });

const update = (id, data, client = prisma) => client.clientPackage.update({ where: { id }, data });

// Row lock so two "book next session" requests cannot both take the last credit.
const lock = (client, id) => client.$queryRaw`SELECT id FROM client_packages WHERE id = ${id}::uuid FOR UPDATE`;

const listForClient = async ({ clientId, page, limit }) => {
  const where = { clientId };
  const [rows, total] = await Promise.all([
    prisma.clientPackage.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.clientPackage.count({ where }),
  ]);
  return { rows, total };
};

const findManyWhere = (where, client = prisma) => client.clientPackage.findMany({ where, include: INCLUDE });

module.exports = { create, findById, findScoped, update, lock, listForClient, findManyWhere };
