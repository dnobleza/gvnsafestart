const adminService = require('../../services/admin.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, meta: pageMeta } = await adminService.list(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const create = async (req, res) => {
  const data = await adminService.create(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data });
};

const deactivate = async (req, res) => {
  const data = await adminService.deactivate(req.params.id, req.user, meta(req));
  res.json({ success: true, data });
};

const resetPassword = async (req, res) => {
  const data = await adminService.resetPassword(req.params.id, req.user, meta(req));
  res.json({ success: true, data });
};

module.exports = { list, create, deactivate, resetPassword };
