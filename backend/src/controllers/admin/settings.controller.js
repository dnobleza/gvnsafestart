const settingsService = require('../../services/settings.service');
const paymentStatus = require('../../services/paymentStatus.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const get = async (req, res) => {
  res.json({ success: true, data: { settings: await settingsService.get() } });
};

const update = async (req, res) => {
  const settings = await settingsService.update(req.user, req.body, meta(req));
  res.json({ success: true, data: { settings } });
};

const paymentProvider = async (req, res) => {
  res.json({ success: true, data: paymentStatus.status() });
};

const testPaymentProvider = async (req, res) => {
  res.json({ success: true, data: await paymentStatus.test(req.user, meta(req)) });
};

module.exports = { get, update, paymentProvider, testPaymentProvider };
