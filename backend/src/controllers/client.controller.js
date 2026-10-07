const portal = require('../services/clientPortal.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const dashboard = async (req, res) => {
  res.json({ success: true, data: await portal.dashboard(req.user) });
};

const createBooking = async (req, res) => {
  const data = await portal.createBooking(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data });
};

const listBookings = async (req, res) => {
  const { data, meta: pageMeta } = await portal.listMine(req.user, req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const getBooking = async (req, res) => {
  res.json({ success: true, data: { booking: await portal.getMine(req.user, req.params.id) } });
};

const cancelBooking = async (req, res) => {
  const booking = await portal.cancel(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { booking } });
};

const rescheduleBooking = async (req, res) => {
  const booking = await portal.reschedule(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { booking } });
};

const pay = async (req, res) => {
  res.json({ success: true, data: await portal.pay(req.user, req.params.id, meta(req)) });
};

const rate = async (req, res) => {
  const rating = await portal.rate(req.user, req.params.id, req.body, meta(req));
  res.status(201).json({ success: true, data: { rating } });
};

const getProfile = async (req, res) => {
  res.json({ success: true, data: { profile: await portal.getProfile(req.user) } });
};

const updateProfile = async (req, res) => {
  res.json({ success: true, data: { profile: await portal.updateProfile(req.user, req.body, meta(req)) } });
};

module.exports = {
  dashboard,
  createBooking,
  listBookings,
  getBooking,
  cancelBooking,
  rescheduleBooking,
  pay,
  rate,
  getProfile,
  updateProfile,
};
