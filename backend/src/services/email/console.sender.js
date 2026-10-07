const logger = require('../../config/logger');

const send = async ({ to, subject, text }) => {
  logger.info(`[email:console] to ${to}: ${subject}\n${text}`);
  return { provider: 'console', delivered: true };
};

module.exports = { send };
