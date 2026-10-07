const auditService = require('../../services/audit.service');

const list = async (req, res) => {
  const { data, meta } = await auditService.list(req.query);
  res.json({ success: true, data, meta });
};

module.exports = { list };
