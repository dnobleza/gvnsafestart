const notificationService = require('../services/notification.service');

const list = async (req, res) => {
  const { data, meta } = await notificationService.list(req.user.id, req.query);
  res.json({ success: true, data, meta });
};

const markRead = async (req, res) => {
  await notificationService.markRead(req.user.id, req.params.id);
  res.json({ success: true, data: { id: req.params.id } });
};

const markAllRead = async (req, res) => {
  res.json({ success: true, data: await notificationService.markAllRead(req.user.id) });
};

module.exports = { list, markRead, markAllRead };
