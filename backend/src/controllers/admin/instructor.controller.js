const instructorService = require('../../services/instructor.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, meta: pageMeta } = await instructorService.list(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const get = async (req, res) => {
  const data = await instructorService.getById(req.params.id);
  res.json({ success: true, data });
};

const create = async (req, res) => {
  const data = await instructorService.create(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data });
};

const update = async (req, res) => {
  const data = await instructorService.update(req.params.id, req.user, req.body, meta(req));
  res.json({ success: true, data });
};

const deactivate = async (req, res) => {
  const data = await instructorService.deactivate(req.params.id, req.user, meta(req));
  res.json({ success: true, data });
};

const resetPassword = async (req, res) => {
  const data = await instructorService.resetPassword(req.params.id, req.user, meta(req));
  res.json({ success: true, data });
};

module.exports = { list, get, create, update, deactivate, resetPassword };
