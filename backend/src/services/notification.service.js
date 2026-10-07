const config = require('../config');
const AppError = require('../utils/AppError');
const notificationRepository = require('../repositories/notification.repository');

const formatWhen = (date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

const toRow = (n) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  bookingId: n.bookingId,
  isRead: n.isRead,
  createdAt: n.createdAt,
});

// Writes the in-app rows inside the caller's transaction and returns the email
// payloads, which the caller sends only after that transaction commits.
const notify = async (tx, items) => {
  await notificationRepository.createMany(
    items.map(({ user, type, title, message, bookingId }) => ({
      userId: user.id,
      type,
      title,
      message,
      bookingId: bookingId || null,
    })),
    tx,
  );
  return items
    .filter(({ user }) => user.email)
    .map(({ user, title, message }) => ({
      to: user.email,
      subject: title,
      text: `Hi ${user.fullName},\n\n${message}\n\nGVN-Safestart`,
    }));
};

const list = async (userId, { page, limit, unread }) => {
  const { rows, total, unreadCount } = await notificationRepository.list({ userId, page, limit, unread });
  return { data: rows.map(toRow), meta: { page, limit, total, unread: unreadCount } };
};

const markRead = async (userId, id) => {
  const count = await notificationRepository.markRead(id, userId);
  if (!count) throw AppError.notFound('NOTIFICATION_NOT_FOUND', 'Notification not found');
};

const markAllRead = async (userId) => ({ updated: await notificationRepository.markAllRead(userId) });

module.exports = { formatWhen, notify, list, markRead, markAllRead };
