const autoComplete = require('../../services/autoComplete.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const status = async (req, res) => {
  res.json({ success: true, data: await autoComplete.status() });
};

const runs = async (req, res) => {
  const { data, meta: pageMeta } = await autoComplete.listRuns(req.query);
  res.json({ success: true, data, meta: pageMeta });
};

const run = async (req, res) => {
  res.json({ success: true, data: await autoComplete.runNow(req.user, meta(req)) });
};

module.exports = { status, runs, run };
