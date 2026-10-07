const registrationService = require('../services/registration.service');

const list = async (req, res) => {
  const { data, meta } = await registrationService.listRegistrations(req.query);
  res.json({ success: true, data, meta });
};

const getOne = async (req, res) => {
  const registration = await registrationService.getRegistration(req.params.id);
  res.json({ success: true, data: { registration } });
};

module.exports = { list, getOne };
