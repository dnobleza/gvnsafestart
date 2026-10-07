const packageService = require('../services/package.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const list = async (req, res) => {
  const { data, meta: pageMeta } = await packageService.listMine(req.user, req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const get = async (req, res) => {
  res.json({ success: true, data: { package: await packageService.getMine(req.user, req.params.id) } });
};

const purchase = async (req, res) => {
  const data = await packageService.purchase(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data });
};

const bookNext = async (req, res) => {
  const pkg = await packageService.bookNextSession(req.user, req.params.id, req.body, meta(req));
  res.status(201).json({ success: true, data: { package: pkg } });
};

const pay = async (req, res) => {
  res.json({ success: true, data: await packageService.pay(req.user, req.params.id, meta(req)) });
};

const cancel = async (req, res) => {
  const pkg = await packageService.cancel(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { package: pkg } });
};

module.exports = { list, get, purchase, bookNext, pay, cancel };
