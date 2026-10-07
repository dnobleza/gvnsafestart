const bcrypt = require('bcrypt');
const config = require('../config');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const { generateTempPassword } = require('../utils/tempPassword');
const userRepository = require('../repositories/user.repository');
const instructorRepository = require('../repositories/instructor.repository');
const branchRepository = require('../repositories/branch.repository');
const registrationRepository = require('../repositories/registration.repository');
const tokenService = require('./token.service');
const auditService = require('./audit.service');

const ADDRESS_FIELDS = ['street', 'barangay', 'city', 'province'];

const toBranch = (user) => {
  const branch = user.instructorProfile && user.instructorProfile.branch;
  return branch ? { id: branch.id, name: branch.name } : null;
};

const toAddress = (user) => {
  const profile = user.instructorProfile;
  if (!profile || profile.street === undefined) return null;
  return {
    street: profile.street,
    barangay: profile.barangay,
    city: profile.city,
    province: profile.province,
  };
};

const toRow = (user) => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
  branch: toBranch(user),
});

const toDetail = (user) => ({ ...toRow(user), address: toAddress(user) });

const requireInstructor = async (id, client) => {
  const user = await instructorRepository.findInstructorById(id, client);
  if (!user) throw AppError.notFound('INSTRUCTOR_NOT_FOUND', 'Instructor not found');
  return user;
};

const requireActiveBranch = async (branchId, client) => {
  const branch = await branchRepository.findById(branchId, client);
  if (!branch || !branch.isActive) {
    throw AppError.badRequest('VALIDATION_ERROR', 'Invalid request body', [
      { field: 'branchId', message: 'Choose an active branch' },
    ]);
  }
  return branch;
};

const list = async ({ status, branchId, page, limit }) => {
  const { rows, total } = await instructorRepository.listInstructors({ status, branchId, page, limit });
  return { data: rows.map(toRow), meta: { page, limit, total } };
};

const getById = async (id) => ({ instructor: toDetail(await requireInstructor(id)) });

const create = async (actor, { fullName, email, address, branchId }, meta) => {
  const branch = await requireActiveBranch(branchId);

  const taken =
    (await userRepository.findByEmail(email)) || (await registrationRepository.findByEmail(email));
  if (taken) throw AppError.conflict('EMAIL_ALREADY_REGISTERED', 'That email already has an account');

  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);

  const user = await prisma.$transaction(async (tx) => {
    const created = await instructorRepository.createInstructor(
      {
        user: { email, fullName, passwordHash, mustChangePassword: true },
        profile: { branchId, ...address },
      },
      tx,
    );
    await auditService.record(tx, {
      actor,
      action: 'INSTRUCTOR_CREATED',
      targetType: 'USER',
      targetId: created.id,
      metadata: { email, fullName, branch: { id: branch.id, name: branch.name }, address },
      meta,
    });
    return created;
  });

  return { instructor: toDetail(user), temporaryPassword };
};

const addressChanged = (current, next) =>
  !current || ADDRESS_FIELDS.some((field) => current[field] !== next[field]);

const update = async (id, actor, input, meta) => {
  const updated = await prisma.$transaction(async (tx) => {
    const target = await requireInstructor(id, tx);
    const currentBranch = toBranch(target);
    const currentAddress = toAddress(target);

    if (!currentBranch && (!input.address || !input.branchId)) {
      throw AppError.badRequest('VALIDATION_ERROR', 'Invalid request body', [
        { field: input.address ? 'branchId' : 'address', message: 'Required to complete this profile' },
      ]);
    }

    const changes = {};
    const profileData = {};

    if (input.fullName !== undefined && input.fullName !== target.fullName) {
      changes.fullName = { from: target.fullName, to: input.fullName };
    }

    if (input.address && addressChanged(currentAddress, input.address)) {
      changes.address = { from: currentAddress, to: input.address };
      Object.assign(profileData, input.address);
    }

    if (input.branchId && (!currentBranch || input.branchId !== currentBranch.id)) {
      const branch = await requireActiveBranch(input.branchId, tx);
      changes.branch = { from: currentBranch, to: { id: branch.id, name: branch.name } };
      profileData.branchId = branch.id;
    }

    if (Object.keys(changes).length === 0) return target;

    if (changes.fullName) await userRepository.update(id, { fullName: input.fullName }, tx);
    if (!currentBranch) {
      await instructorRepository.createProfile(
        { userId: id, branchId: input.branchId, ...input.address },
        tx,
      );
    } else if (Object.keys(profileData).length > 0) {
      await instructorRepository.updateProfile(id, profileData, tx);
    }
    await auditService.record(tx, {
      actor,
      action: 'INSTRUCTOR_UPDATED',
      targetType: 'USER',
      targetId: id,
      metadata: { changes },
      meta,
    });
    return requireInstructor(id, tx);
  });

  return { instructor: toDetail(updated) };
};

const deactivate = async (id, actor, meta) => {
  const updated = await prisma.$transaction(async (tx) => {
    const target = await requireInstructor(id, tx);
    if (!target.isActive) return target;

    await userRepository.update(id, { isActive: false }, tx);
    await tokenService.revokeAllForUser(id, tx);
    await auditService.record(tx, {
      actor,
      action: 'INSTRUCTOR_DEACTIVATED',
      targetType: 'USER',
      targetId: id,
      metadata: { email: target.email },
      meta,
    });
    return requireInstructor(id, tx);
  });

  return { instructor: toRow(updated) };
};

const resetPassword = async (id, actor, meta) => {
  const temporaryPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, config.bcryptRounds);

  await prisma.$transaction(async (tx) => {
    const target = await requireInstructor(id, tx);
    await userRepository.update(id, { passwordHash, mustChangePassword: true }, tx);
    await tokenService.revokeAllForUser(id, tx);
    await auditService.record(tx, {
      actor,
      action: 'INSTRUCTOR_PASSWORD_RESET',
      targetType: 'USER',
      targetId: id,
      metadata: { email: target.email },
      meta,
    });
  });

  return { temporaryPassword };
};

const getOwnProfile = async (actor) => {
  const user = await requireInstructor(actor.id);
  return {
    profile: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      branch: toBranch(user),
      address: toAddress(user),
    },
  };
};

module.exports = { list, getById, create, update, deactivate, resetPassword, getOwnProfile };
