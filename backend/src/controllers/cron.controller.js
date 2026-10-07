const autoComplete = require('../services/autoComplete.service');

const autoCompleteRun = async (req, res) => {
  res.json({ success: true, data: await autoComplete.runAutoComplete({ trigger: 'EXTERNAL' }) });
};

module.exports = { autoCompleteRun };
