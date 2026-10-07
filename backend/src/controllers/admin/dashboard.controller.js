const dashboardService = require('../../services/dashboard.service');

const overview = async (_req, res) => {
  res.json({ success: true, data: await dashboardService.overview() });
};

module.exports = { overview };
