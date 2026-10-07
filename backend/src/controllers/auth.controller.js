const config = require('../config');
const authService = require('../services/auth.service');
const registrationService = require('../services/registration.service');

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/api/v1/auth',
});

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

// The refresh token leaves only in an httpOnly cookie; the body carries the
// access token alone so client JS never touches the long-lived credential.
const sendSession = (res, status, { user, accessToken, refreshToken }) => {
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions());
  res.status(status).json({ success: true, data: { user, accessToken } });
};

const register = async (req, res) => {
  const user = await registrationService.register(req.body);
  sendSession(res, 201, await authService.startSession(user, meta(req)));
};

const login = async (req, res) => {
  sendSession(res, 200, await authService.loginWithPassword(req.body, meta(req)));
};

const google = async (req, res) => {
  sendSession(res, 200, await authService.loginWithGoogle(req.body.idToken, meta(req)));
};

const facebook = async (req, res) => {
  sendSession(res, 200, await authService.loginWithFacebook(req.body.accessToken, meta(req)));
};

const requestOtp = async (req, res) => {
  res.json({ success: true, data: await authService.requestPhoneOtp(req.body.phone) });
};

const verifyOtp = async (req, res) => {
  sendSession(res, 200, await authService.verifyPhoneOtp(req.body, meta(req)));
};

const refresh = async (req, res) => {
  sendSession(res, 200, await authService.refresh(req.cookies[REFRESH_COOKIE], meta(req)));
};

const changePassword = async (req, res) => {
  sendSession(res, 200, await authService.changePassword(req.user.id, req.body, meta(req)));
};

const logout = async (req, res) => {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
  res.json({ success: true, data: { loggedOut: true } });
};

const me = async (req, res) => {
  res.json({ success: true, data: { user: await authService.me(req.user.id) } });
};

module.exports = {
  register,
  login,
  google,
  facebook,
  requestOtp,
  verifyOtp,
  refresh,
  changePassword,
  logout,
  me,
  REFRESH_COOKIE,
};
