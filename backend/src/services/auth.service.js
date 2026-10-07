const bcrypt = require('bcrypt');
const crypto = require('crypto');
const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/user.repository');
const authIdentityRepository = require('../repositories/authIdentity.repository');
const phoneOtpRepository = require('../repositories/phoneOtp.repository');
const registrationService = require('./registration.service');
const tokenService = require('./token.service');
const auditService = require('./audit.service');
const googleVerifier = require('./providers/google.verifier');
const facebookVerifier = require('./providers/facebook.verifier');
const sms = require('./sms');

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  phone: user.phone,
  fullName: user.fullName,
  role: user.role,
  mustChangePassword: user.mustChangePassword,
});

const assertLoginable = (user) => {
  if (!user.isActive) throw AppError.forbidden('ACCOUNT_INACTIVE', 'Account is disabled');
};

const startSession = async (user, meta) => {
  assertLoginable(user);
  const session = await tokenService.issueSession(user, meta);
  return { user: publicUser(user), ...session };
};

// A failed password login must not reveal whether the email exists, so the
// unknown-email and wrong-password branches return the same error.
const loginWithPassword = async ({ email, password }, meta) => {
  const user = await userRepository.findByEmail(email);

  if (!user) {
    throw AppError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  if (!user.passwordHash) {
    throw AppError.forbidden(
      'PASSWORD_LOGIN_UNAVAILABLE',
      'This account signs in with Google, Facebook, or a mobile number',
    );
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw AppError.unauthorized('INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  return startSession(user, meta);
};

// Shared tail for every external-identity login. Three outcomes:
//   known identity  -> sign in
//   known email     -> link this provider to the existing account, sign in
//   brand new       -> create the account and sign in
const loginWithIdentity = async ({ provider, providerUserId, email, phone, fullName }, meta) => {
  const byIdentity = await userRepository.findByProviderIdentity(provider, providerUserId);
  if (byIdentity) return startSession(byIdentity, meta);

  const existing = email
    ? await userRepository.findByEmail(email)
    : phone
      ? await userRepository.findByPhone(phone)
      : null;

  if (existing) {
    // Linking by email trusts the provider's claim that the address is owned,
    // which Facebook does not verify. A wrong claim on a INSTRUCTOR or ADMIN account
    // would be a full takeover, so those accounts only sign in with their own
    // password or an identity linked some other way.
    if (existing.role !== 'CLIENT') {
      throw AppError.forbidden(
        'IDENTITY_LINK_NOT_ALLOWED',
        'This account must sign in with its email and password',
      );
    }
    await authIdentityRepository.create({
      userId: existing.id,
      provider,
      providerUserId,
      email: email || null,
    });
    return startSession(existing, meta);
  }

  const created = await registrationService.registerFromProvider({
    provider,
    providerUserId,
    email,
    phone,
    fullName,
  });

  return startSession(created, meta);
};

const loginWithGoogle = async (idToken, meta) => {
  const profile = await googleVerifier.verify(idToken);
  return loginWithIdentity({ provider: 'GOOGLE', ...profile }, meta);
};

const loginWithFacebook = async (accessToken, meta) => {
  const profile = await facebookVerifier.verify(accessToken);
  return loginWithIdentity({ provider: 'FACEBOOK', ...profile }, meta);
};

const generateCode = () => {
  const max = 10 ** config.otp.length;
  return String(crypto.randomInt(0, max)).padStart(config.otp.length, '0');
};

// Always resolves, even for a number with no account: a different response for
// known vs unknown numbers would turn this into a membership oracle.
const requestPhoneOtp = async (phone) => {
  await phoneOtpRepository.invalidateForPhone(phone);

  const code = generateCode();
  await phoneOtpRepository.create({
    phone,
    codeHash: await bcrypt.hash(code, config.bcryptRounds),
    expiresAt: new Date(Date.now() + config.otp.ttlSeconds * 1000),
  });

  await sms.send({
    phone,
    message: `Your SafeStart verification code is ${code}. It expires in ${Math.round(config.otp.ttlSeconds / 60)} minutes.`,
  });

  return { sent: true, expiresInSeconds: config.otp.ttlSeconds };
};

const verifyPhoneOtp = async ({ phone, code, fullName }, meta) => {
  const otp = await phoneOtpRepository.findLatestActive(phone);
  if (!otp) throw AppError.unauthorized('OTP_EXPIRED', 'No active code for this number');

  if (otp.attempts >= config.otp.maxAttempts) {
    await phoneOtpRepository.consume(otp.id);
    throw AppError.unauthorized('OTP_ATTEMPTS_EXCEEDED', 'Too many incorrect codes');
  }

  if (!(await bcrypt.compare(code, otp.codeHash))) {
    await phoneOtpRepository.incrementAttempts(otp.id);
    throw AppError.unauthorized('INVALID_OTP', 'Verification code is incorrect');
  }

  await phoneOtpRepository.consume(otp.id);

  const user = await userRepository.findByPhone(phone);
  if (user) return startSession(user, meta);

  const created = await registrationService.registerFromProvider({
    provider: 'PHONE',
    providerUserId: phone,
    email: null,
    phone,
    fullName: fullName || phone,
  });

  return startSession(created, meta);
};

const refresh = async (rawToken, meta) => {
  const { user, accessToken, refreshToken } = await tokenService.rotateRefreshToken(rawToken, meta);
  return { user: publicUser(user), accessToken, refreshToken };
};

const changePassword = async (userId, { currentPassword, newPassword }, meta) => {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.unauthorized('UNAUTHORIZED', 'Account no longer exists');
  assertLoginable(user);

  if (!user.passwordHash) {
    throw AppError.forbidden(
      'PASSWORD_LOGIN_UNAVAILABLE',
      'This account signs in with Google, Facebook, or a mobile number',
    );
  }

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.unauthorized('INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcryptRounds);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await userRepository.update(
      userId,
      { passwordHash, mustChangePassword: false },
      tx,
    );
    await tokenService.revokeAllForUser(userId, tx);
    await auditService.record(tx, {
      actor: user,
      action: 'PASSWORD_CHANGED',
      targetType: 'USER',
      targetId: userId,
      metadata: { email: user.email, wasTemporary: user.mustChangePassword },
      meta,
    });
    return saved;
  });

  return startSession(updated, meta);
};

const logout = (rawToken) => tokenService.revokeRefreshToken(rawToken);

const me = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw AppError.notFound('USER_NOT_FOUND', 'User not found');
  return publicUser(user);
};

module.exports = {
  startSession,
  loginWithPassword,
  loginWithGoogle,
  loginWithFacebook,
  requestPhoneOtp,
  verifyPhoneOtp,
  refresh,
  changePassword,
  logout,
  me,
  publicUser,
};
