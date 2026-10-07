const rateLimit = require('express-rate-limit');
const config = require('../config');

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, try again later' },
  },
});

// Tighter than authLimiter and keyed by the target phone number, so one caller
// cannot burn through someone else's OTP budget from a different IP.
const otpLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.otp.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.phone) || ''}`,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many code requests, try again later' },
  },
});

// Unauthenticated catalogue browsing: generous, but bounded per IP.
const publicLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.publicMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, try again later' },
  },
});

module.exports = { authLimiter, otpLimiter, publicLimiter };
