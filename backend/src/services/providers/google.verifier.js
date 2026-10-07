const { OAuth2Client } = require('google-auth-library');
const config = require('../../config');
const AppError = require('../../utils/AppError');

let client;

const isConfigured = () => Boolean(config.google.clientId);

const verify = async (idToken) => {
  if (!isConfigured()) {
    throw new AppError('PROVIDER_NOT_CONFIGURED', 503, 'Google sign-in is not configured');
  }

  client = client || new OAuth2Client(config.google.clientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw AppError.unauthorized('INVALID_PROVIDER_TOKEN', 'Google token is invalid');
  }

  if (!payload || !payload.sub) {
    throw AppError.unauthorized('INVALID_PROVIDER_TOKEN', 'Google token is missing a subject');
  }

  return {
    providerUserId: payload.sub,
    email: payload.email_verified ? payload.email : null,
    fullName: payload.name || payload.email || 'Google user',
  };
};

module.exports = { verify, isConfigured };
