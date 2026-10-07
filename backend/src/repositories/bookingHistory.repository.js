const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.bookingHistory.create({ data });

const listForBooking = (bookingId, client = prisma) =>
  client.bookingHistory.findMany({
    where: { bookingId },
    include: { changedBy: { select: { id: true, fullName: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

module.exports = { create, listForBooking };
