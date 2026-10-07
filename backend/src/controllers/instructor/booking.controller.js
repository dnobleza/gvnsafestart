const portal = require('../../services/instructorPortal.service');
const cashService = require('../../services/cash.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const dashboard = async (req, res) => {
  res.json({ success: true, data: await portal.dashboard(req.user) });
};

const list = async (req, res) => {
  const { data, meta: pageMeta } = await portal.listBookings(req.user, req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const get = async (req, res) => {
  res.json({ success: true, data: { booking: await portal.getBooking(req.user, req.params.id) } });
};

const history = async (req, res) => {
  res.json({ success: true, data: { history: await portal.history(req.user, req.params.id) } });
};

const confirm = async (req, res) => {
  res.json({ success: true, data: { booking: await portal.confirm(req.user, req.params.id, meta(req)) } });
};

const reschedule = async (req, res) => {
  const booking = await portal.reschedule(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { booking } });
};

const complete = async (req, res) => {
  res.json({ success: true, data: { booking: await portal.complete(req.user, req.params.id, meta(req)) } });
};

const noShow = async (req, res) => {
  res.json({ success: true, data: { booking: await portal.noShow(req.user, req.params.id, meta(req)) } });
};

const cancel = async (req, res) => {
  const booking = await portal.cancel(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { booking } });
};

const correctNoShow = async (req, res) => {
  const booking = await portal.correctNoShow(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { booking } });
};

const recordCash = async (req, res) => {
  const booking = await cashService.record(req.user, req.params.id, req.body, meta(req));
  res.status(201).json({ success: true, data: { booking } });
};

const schedule = async (req, res) => {
  res.json({ success: true, data: { bookings: await portal.schedule(req.user, req.query) } });
};

module.exports = { dashboard, list, get, history, confirm, reschedule, complete, noShow, cancel, correctNoShow, recordCash, schedule };
