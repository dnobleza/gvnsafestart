const prisma = require('../config/prisma');

const create = (data) => prisma.phoneOtp.create({ data });

const findLatestActive = (phone) =>
  prisma.phoneOtp.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

const incrementAttempts = (id) =>
  prisma.phoneOtp.update({ where: { id }, data: { attempts: { increment: 1 } } });

const consume = (id) =>
  prisma.phoneOtp.update({ where: { id }, data: { consumedAt: new Date() } });

const invalidateForPhone = (phone) =>
  prisma.phoneOtp.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });

module.exports = { create, findLatestActive, incrementAttempts, consume, invalidateForPhone };
