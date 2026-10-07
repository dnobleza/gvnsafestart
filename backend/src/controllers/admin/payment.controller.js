const paymentService = require('../../services/payment.service');

const list = async (req, res) => {
  const { data, meta } = await paymentService.list(req.query);
  res.json({ success: true, data, meta });
};

module.exports = { list };
