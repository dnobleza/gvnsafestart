const prisma = require('../config/prisma');

const create = (data) => prisma.refreshToken.create({ data });

const findByHash = (tokenHash) =>
  prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });

const revoke = (id) =>
  prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });

const revokeAllForUser = (userId, client = prisma) =>
  client.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

const deleteExpired = () =>
  prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });

module.exports = { create, findByHash, revoke, revokeAllForUser, deleteExpired };
