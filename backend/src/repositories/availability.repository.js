const prisma = require('../config/prisma');

const listWeekly = (instructorId, client = prisma) =>
  client.instructorAvailability.findMany({
    where: { instructorId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

const listForDay = (instructorId, dayOfWeek, client = prisma) =>
  client.instructorAvailability.findMany({
    where: { instructorId, dayOfWeek },
    orderBy: { startTime: 'asc' },
  });

const replaceWeekly = async (instructorId, slots, client) => {
  await client.instructorAvailability.deleteMany({ where: { instructorId } });
  if (slots.length) {
    await client.instructorAvailability.createMany({
      data: slots.map((s) => ({ instructorId, ...s })),
    });
  }
};

const listDaysOff = (instructorId, fromDate, client = prisma) =>
  client.instructorDayOff.findMany({
    where: { instructorId, ...(fromDate ? { date: { gte: fromDate } } : {}) },
    orderBy: { date: 'asc' },
  });

const findDayOff = (instructorId, date, client = prisma) =>
  client.instructorDayOff.findUnique({ where: { instructorId_date: { instructorId, date } } });

const createDayOff = (data, client = prisma) => client.instructorDayOff.create({ data });

const findDayOffScoped = (id, instructorId, client = prisma) =>
  client.instructorDayOff.findFirst({ where: { id, instructorId } });

const deleteDayOff = (id, client = prisma) => client.instructorDayOff.delete({ where: { id } });

module.exports = {
  listWeekly,
  listForDay,
  replaceWeekly,
  listDaysOff,
  findDayOff,
  createDayOff,
  findDayOffScoped,
  deleteDayOff,
};
