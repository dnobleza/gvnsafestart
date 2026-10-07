const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.cashVoidRequest.create({ data });

const findById = (id, client = prisma) =>
  client.cashVoidRequest.findUnique({ where: { id }, include: { payment: true } });

const findPending = (paymentId, client = prisma) =>
  client.cashVoidRequest.findFirst({ where: { paymentId, status: 'PENDING' } });

const updateIfPending = async (id, data, client) => {
  const { count } = await client.cashVoidRequest.updateMany({ where: { id, status: 'PENDING' }, data });
  return count;
};

const list = async ({ status, page, limit }) => {
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.cashVoidRequest.findMany({
      where,
      include: {
        requestedBy: { select: { id: true, fullName: true } },
        reviewedBy: { select: { id: true, fullName: true } },
        payment: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            client: { select: { id: true, fullName: true } },
            booking: { select: { id: true, scheduledAt: true, lessonType: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cashVoidRequest.count({ where }),
  ]);
  return { rows, total };
};

module.exports = { create, findById, findPending, updateIfPending, list };
