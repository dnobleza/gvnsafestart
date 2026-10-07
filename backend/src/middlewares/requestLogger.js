const { randomUUID } = require('crypto');
const logger = require('../config/logger');

module.exports = function requestLogger(req, res, next) {
  req.id = req.get('x-request-id') || randomUUID();
  res.set('x-request-id', req.id);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('request', {
      id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    });
  });

  next();
};
