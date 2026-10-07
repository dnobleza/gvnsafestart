const prisma = require('../config/prisma');

const list = (instructorId, clientId) =>
  prisma.clientNote.findMany({
    where: { instructorId, clientId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

const create = (data, client = prisma) => client.clientNote.create({ data });

module.exports = { list, create };
