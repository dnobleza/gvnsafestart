const geocoder = require('../services/geocoder.service');

const reverse = async (req, res) => {
  res.json({ success: true, data: { place: await geocoder.reverse(req.query) } });
};

module.exports = { reverse };
