const config = require('../../config');
const AppError = require('../../utils/AppError');

const GRAPH = 'https://graph.facebook.com/v21.0';

const isConfigured = () => Boolean(config.facebook.appId && config.facebook.appSecret);

// debug_token first: it proves the access token was minted for THIS app. Without
// that check any valid Facebook token from any app would be accepted.
const verify = async (accessToken) => {
  if (!isConfigured()) {
    throw new AppError('PROVIDER_NOT_CONFIGURED', 503, 'Facebook sign-in is not configured');
  }

  const appToken = `${config.facebook.appId}|${config.facebook.appSecret}`;

  const debugRes = await fetch(
    `${GRAPH}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`,
  );
  const debug = await debugRes.json().catch(() => ({}));
  const data = debug && debug.data;

  if (!debugRes.ok || !data || !data.is_valid || data.app_id !== config.facebook.appId) {
    throw AppError.unauthorized('INVALID_PROVIDER_TOKEN', 'Facebook token is invalid');
  }

  const profileRes = await fetch(
    `${GRAPH}/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`,
  );
  const profile = await profileRes.json().catch(() => ({}));

  if (!profileRes.ok || !profile.id) {
    throw AppError.unauthorized('INVALID_PROVIDER_TOKEN', 'Facebook profile unavailable');
  }

  return {
    providerUserId: profile.id,
    email: profile.email || null,
    fullName: profile.name || 'Facebook user',
  };
};

module.exports = { verify, isConfigured };
