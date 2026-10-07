const portal = require('../../services/instructorPortal.service');
const availabilityService = require('../../services/availability.service');
const cashService = require('../../services/cash.service');
const ratingService = require('../../services/rating.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const listClients = async (req, res) => {
  const { data, meta: pageMeta } = await portal.listClients(req.user, req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const getClient = async (req, res) => {
  res.json({ success: true, data: await portal.getClient(req.user, req.params.id) });
};

const addNote = async (req, res) => {
  const note = await portal.addNote(req.user, req.params.id, req.body, meta(req));
  res.status(201).json({ success: true, data: { note } });
};

const getAvailability = async (req, res) => {
  res.json({ success: true, data: await availabilityService.getAvailability(req.user.id) });
};

const putAvailability = async (req, res) => {
  const data = await availabilityService.replaceWeekly(req.user, req.body.weekly, meta(req));
  res.json({ success: true, data });
};

const slots = async (req, res) => {
  res.json({ success: true, data: await portal.slots(req.user, req.query) });
};

const addDayOff = async (req, res) => {
  const dayOff = await availabilityService.addDayOff(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data: { dayOff } });
};

const removeDayOff = async (req, res) => {
  await availabilityService.removeDayOff(req.user, req.params.id, meta(req));
  res.json({ success: true, data: { id: req.params.id } });
};

const listCash = async (req, res) => {
  const { data, meta: pageMeta } = await cashService.listMine(req.user.id, req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const requestVoid = async (req, res) => {
  const voidRequest = await cashService.requestVoid(req.user, req.params.id, req.body, meta(req));
  res.status(201).json({ success: true, data: { voidRequest } });
};

const ratings = async (req, res) => {
  const { summary, data, meta: pageMeta } = await ratingService.forInstructor(req.user.id, req.query);
  res.json({ success: true, data: { summary, ratings: data }, meta: pageMeta });
};

module.exports = {
  listClients,
  getClient,
  addNote,
  getAvailability,
  putAvailability,
  slots,
  addDayOff,
  removeDayOff,
  listCash,
  requestVoid,
  ratings,
};
