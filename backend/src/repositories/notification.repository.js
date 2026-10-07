const prisma = require('../config/prisma');

const createMany = (rows, client = prisma) =>
  rows.length ? client.notification.createMany({ data: rows }) : Promise.resolve({ count: 0 });

const list = async ({ userId, page, limit, unread }) => {
  const where = { userId, ...(unread ? { isRead: false } : {}) };
  const [rows, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return { rows, total, unreadCount };
};

const countUnread = (userId) => prisma.notification.count({ where: { userId, isRead: false } });

const markRead = async (id, userId) => {
  const { count } = await prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
  return count;
};

const markAllRead = async (userId) => {
  const { count } = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return count;
};

module.exports = { createMany, list, countUnread, markRead, markAllRead };
