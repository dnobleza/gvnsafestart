const prisma = require('../config/prisma');

const create = (data) => prisma.registration.create({ data });

const findById = (id) => prisma.registration.findUnique({ where: { id } });

const findByEmail = (email) => prisma.registration.findUnique({ where: { email } });

const findByPhone = (phone) => prisma.registration.findUnique({ where: { phone } });

const findByProviderId = (provider, providerUserId) =>
  prisma.registration.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
  });

const list = async ({ page, limit }) => {
  const [rows, total] = await Promise.all([
    prisma.registration.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.registration.count(),
  ]);
  return { rows, total };
};

module.exports = {
  create,
  findById,
  findByEmail,
  findByPhone,
  findByProviderId,
  list,
};
