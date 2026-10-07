const bcrypt = require('bcrypt');
const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateTempPassword } = require('../utils/tempPassword');
const userRepository = require('../repositories/user.repository');
const registrationRepository = require('../repositories/registration.repository');
const tokenService = require('./token.service');
const auditService = require('./audit.service');

const toAdmin = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
});

const requireAdmin = async (id, client) => {
  const user = await userRepository.findByRoleAndId('ADMIN', id, client);
  if (!user) throw AppError.notFound('ADMIN_NOT_FOUND', 'Admin not found');
  return user;
};

const list = async ({ status, page, limit }) => {
  const { rows, total } = await userRepository.listByRole({ role: 'ADMIN', status, page, limit });
  return { data: rows.map(toAdmin), meta: { page, limit, total } };
};

const create = async (actor, { fullName, email }, meta) => {
  const taken =
    (await userRepository.findByEmail(email)) || (await registrationRepository.findByEmail(email));
  if (taken) throw AppError.conflict('EMAIL_ALREADY_REGISTERED', 'That email already has an account');

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);

  const user = await prisma.$transaction(async (tx) => {
    const created = await userRepository.create(
      { email, fullName, role: 'ADMIN', passwordHash, mustChangePassword: true },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'ADMIN_CREATED',
      targetType: 'USER',
      targetId: created.id,
      metadata: { email, fullName },
      meta,
    });
    return created;
  });

  return { admin: toAdmin(user), temporaryPassword };
};

const deactivate = async (id, actor, meta) => {
  if (id === actor.id) {
    throw AppError.conflict('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account');
  }

  const updated = await prisma.$transaction(async (tx) => {
    const target = await requireAdmin(id, tx);
    if (!target.isActive) return target;

    await userRepository.lockActiveAdmins(tx);
    if ((await userRepository.countActiveAdminsExcept(id, tx)) === 0) {
      throw AppError.conflict('LAST_ADMIN', 'At least one active admin is required');
    }

    const user = await userRepository.update(id, { isActive: false }, tx);
    await tokenService.revokeAllForUser(id, tx);
    await auditService.record(tx, {
      actor,
      action: 'ADMIN_DEACTIVATED',
      targetType: 'USER',
      targetId: id,
      metadata: { email: target.email },
      meta,
    });
    return user;
  });

  return { admin: toAdmin(updated) };
};

const resetPassword = async (id, actor, meta) => {
  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);

  await prisma.$transaction(async (tx) => {
    const target = await requireAdmin(id, tx);
    await userRepository.update(id, { passwordHash, mustChangePassword: true }, tx);
    await tokenService.revokeAllForUser(id, tx);
    await auditService.record(tx, {
      actor,
      action: 'ADMIN_PASSWORD_RESET',
      targetType: 'USER',
      targetId: id,
      metadata: { email: target.email },
      meta,
    });
  });

  return { temporaryPassword };
};

module.exports = { list, create, deactivate, resetPassword };
