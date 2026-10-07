const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');
const refreshTokenRepository = require('../repositories/refreshToken.repository');

const REFRESH_BYTES = 32;

const issueAccessToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl,
  });

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw AppError.unauthorized('INVALID_ACCESS_TOKEN', 'Access token is invalid or expired');
  }
};

// SHA-256 rather than bcrypt: the token is already 256 bits of entropy, so
// stretching buys nothing, and lookup has to be an exact-match index hit.
const hashRefreshToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

const refreshExpiry = () => {
  const match = /^(\d+)([smhd])$/.exec(config.jwt.refreshTtl);
  if (!match) throw new Error(`Unsupported JWT_REFRESH_TTL: ${config.jwt.refreshTtl}`);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return new Date(Date.now() + Number(match[1]) * unitMs);
};

const issueRefreshToken = async (user, meta = {}) => {
  const raw = crypto.randomBytes(REFRESH_BYTES).toString('hex');
  await refreshTokenRepository.create({
    userId: user.id,
    tokenHash: hashRefreshToken(raw),
    expiresAt: refreshExpiry(),
    userAgent: meta.userAgent || null,
    ip: meta.ip || null,
  });
  return raw;
};

const issueSession = async (user, meta) => ({
  accessToken: issueAccessToken(user),
  refreshToken: await issueRefreshToken(user, meta),
});

const rotateRefreshToken = async (raw, meta = {}) => {
  if (!raw) throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token missing');

  const stored = await refreshTokenRepository.findByHash(hashRefreshToken(raw));
  if (!stored) throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token not recognized');

  // A revoked token presented again means the value leaked: kill every session
  // for that user rather than just refusing this one request.
  if (stored.revokedAt) {
    await refreshTokenRepository.revokeAllForUser(stored.userId);
    throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token already used');
  }

  if (stored.expiresAt <= new Date()) {
    throw AppError.unauthorized('INVALID_REFRESH_TOKEN', 'Refresh token expired');
  }

  if (!stored.user.isActive) throw AppError.forbidden('ACCOUNT_INACTIVE', 'Account is disabled');

  await refreshTokenRepository.revoke(stored.id);
  return { user: stored.user, ...(await issueSession(stored.user, meta)) };
};

const revokeRefreshToken = async (raw) => {
  if (!raw) return;
  const stored = await refreshTokenRepository.findByHash(hashRefreshToken(raw));
  if (stored && !stored.revokedAt) await refreshTokenRepository.revoke(stored.id);
};

const revokeAllForUser = (userId, client) => refreshTokenRepository.revokeAllForUser(userId, client);

module.exports = {
  issueAccessToken,
  verifyAccessToken,
  issueRefreshToken,
  issueSession,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
