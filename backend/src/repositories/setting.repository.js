const prisma = require('../config/prisma');

const findAll = (client = prisma) => client.appSetting.findMany();

const upsert = (key, value, updatedById, client = prisma) =>
  client.appSetting.upsert({
    where: { key },
    update: { value, updatedById },
    create: { key, value, updatedById },
  });

module.exports = { findAll, upsert };
