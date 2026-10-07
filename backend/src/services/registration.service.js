const bcrypt = require('bcrypt');
const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const registrationRepository = require('../repositories/registration.repository');
const userRepository = require('../repositories/user.repository');

const PUBLIC_FIELDS = [
  'id',
  'email',
  'phone',
  'fullName',
  'role',
  'provider',
  'providerUserId',
  'createdAt',
];

const toPublic = (registration) => {
  if (!registration) return null;
  const out = {};
  for (const key of PUBLIC_FIELDS) out[key] = registration[key];
  return out;
};

// Shared gate for every signup path. An identifier can be taken either by a live
// account or by an older signup record, and both are a plain conflict now that
// there is no approval state to be in.
const assertIdentifierAvailable = async ({ email, phone }) => {
  if (email) {
    const taken =
      (await userRepository.findByEmail(email)) || (await registrationRepository.findByEmail(email));
    if (taken) {
      throw AppError.conflict('EMAIL_ALREADY_REGISTERED', 'That email already has an account');
    }
  }

  if (phone) {
    const taken =
      (await userRepository.findByPhone(phone)) || (await registrationRepository.findByPhone(phone));
    if (taken) {
      throw AppError.conflict(
        'PHONE_ALREADY_REGISTERED',
        'That mobile number already has an account',
      );
    }
  }
};

// Writes the account and its signup record together. One transaction, because a
// login with no history -- or history with no login -- would both be wrong.
const createAccount = async ({
  email,
  phone,
  passwordHash,
  fullName,
  provider,
  providerUserId,
}) => {
  const details = {
    email: email || null,
    phone: phone || null,
    passwordHash: passwordHash || null,
    fullName,
    // Never taken from the request: a self-service signup must not be able to
    // ask for ADMIN or INSTRUCTOR.
    role: 'CLIENT',
    provider,
    providerUserId: providerUserId || null,
  };

  return prisma.$transaction(async (tx) => {
    const user = await userRepository.create(
      {
        email: details.email,
        phone: details.phone,
        passwordHash: details.passwordHash,
        fullName: details.fullName,
        role: details.role,
      },
      tx,
    );

    const registration = await tx.registration.create({ data: details });

    if (provider !== 'LOCAL' && details.providerUserId) {
      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: details.providerUserId,
          email: details.email,
        },
      });
    }

    return { user, registration };
  });
};

const register = async ({ email, password, phone, fullName }) => {
  await assertIdentifierAvailable({ email, phone });

  const { user } = await createAccount({
    email,
    phone,
    passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    fullName,
    provider: 'LOCAL',
  });

  return user;
};

const registerFromProvider = async ({ provider, providerUserId, email, phone, fullName }) => {
  const byProvider = await registrationRepository.findByProviderId(provider, providerUserId);
  if (byProvider) {
    throw AppError.conflict('EMAIL_ALREADY_REGISTERED', 'That identity already has an account');
  }

  await assertIdentifierAvailable({ email, phone });

  const { user } = await createAccount({
    email,
    phone,
    passwordHash: null,
    fullName,
    provider,
    providerUserId,
  });

  return user;
};

const listRegistrations = async ({ page, limit }) => {
  const { rows, total } = await registrationRepository.list({ page, limit });
  return { data: rows.map(toPublic), meta: { page, limit, total } };
};

const getRegistration = async (id) => {
  const registration = await registrationRepository.findById(id);
  if (!registration) throw AppError.notFound('REGISTRATION_NOT_FOUND', 'Registration not found');
  return toPublic(registration);
};

module.exports = {
  register,
  registerFromProvider,
  listRegistrations,
  getRegistration,
  toPublic,
};
