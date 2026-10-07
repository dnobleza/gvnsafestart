const cron = require('node-cron');
const config = require('../config');
const logger = require('../config/logger');
const autoComplete = require('../services/autoComplete.service');

// Every 15 minutes, Manila time. Other instances running the same schedule
// skip the run through the advisory lock inside runAutoComplete.
const start = () =>
  cron.schedule(
    autoComplete.SCHEDULE,
    async () => {
      const result = await autoComplete.runAutoComplete({ trigger: 'SCHEDULE' });
      if (result.status === 'SUCCESS' && (result.completed || result.cancelled)) {
        logger.info(`Auto-complete: ${result.completed} completed, ${result.cancelled} cancelled, ${result.cashUnpaid} cash unpaid`);
      }
    },
    { timezone: config.timezone },
  );

module.exports = { start };
