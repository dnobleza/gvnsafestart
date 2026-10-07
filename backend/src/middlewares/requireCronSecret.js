const crypto = require('crypto');
const config = require('../config');
const AppError = require('../utils/AppError');

const digest = (value) => crypto.createHash('sha256').update(value).digest();

// For an external scheduler, not a user: `Authorization: Bearer <CRON_SECRET>`.
// Hashing both sides gives equal-length buffers for the timing-safe compare.
// With no secret configured the endpoint is closed.
const requireCronSecret = (req, res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  const secret = config.cron.secret;
  if (!secret || scheme !== 'Bearer' || !token || !crypto.timingSafeEqual(digest(token), digest(secret))) {
    return next(new AppError('UNAUTHORIZED', 401, 'Invalid cron credentials'));
  }
  return next();
};

module.exports = requireCronSecret;
