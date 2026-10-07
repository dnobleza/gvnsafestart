const bookingService = require('../../services/booking.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, meta: pageMeta } = await bookingService.list(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const get = async (req, res) => {
  res.json({ success: true, data: { booking: await bookingService.get(req.params.id) } });
};

const history = async (req, res) => {
  res.json({ success: true, data: { history: await bookingService.history(req.params.id) } });
};

const approve = async (req, res) => {
  const booking = await bookingService.approve(req.params.id, req.user, meta(req));
  res.json({ success: true, data: { booking } });
};

const reschedule = async (req, res) => {
  const booking = await bookingService.reschedule(req.params.id, req.body, req.user, meta(req));
  res.json({ success: true, data: { booking } });
};

const cancel = async (req, res) => {
  const booking = await bookingService.cancel(req.params.id, req.body, req.user, meta(req));
  res.json({ success: true, data: { booking } });
};

module.exports = { list, get, history, approve, reschedule, cancel };
