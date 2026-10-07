const prisma = require('../config/prisma');

const findByUser = (userId, client = prisma) => client.clientProfile.findUnique({ where: { userId } });

const upsert = (userId, data, client = prisma) =>
  client.clientProfile.upsert({ where: { userId }, update: data, create: { userId, ...data } });

module.exports = { findByUser, upsert };
