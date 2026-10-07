const branchService = require('../../services/branch.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, meta: pageMeta } = await branchService.list(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const options = async (_req, res) => {
  const data = await branchService.options();
  res.json({ success: true, data });
};

const create = async (req, res) => {
  const data = await branchService.create(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data });
};

const update = async (req, res) => {
  const data = await branchService.update(req.params.id, req.user, req.body, meta(req));
  res.json({ success: true, data });
};

module.exports = { list, options, create, update };
