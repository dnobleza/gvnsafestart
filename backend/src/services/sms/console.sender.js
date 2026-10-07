const logger = require('../../config/logger');

const send = async ({ phone, message }) => {
  logger.info(`[sms:console] to ${phone}: ${message}`);
  return { provider: 'console', delivered: true };
};

module.exports = { send };
