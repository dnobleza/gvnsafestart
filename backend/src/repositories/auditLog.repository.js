const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.auditLog.create({ data });

const list = async ({ action, actorId, page, limit }) => {
  const where = {};
  if (action) where.action = action;
  if (actorId) where.actorId = actorId;

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { id: true, fullName: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
};

module.exports = { create, list };
