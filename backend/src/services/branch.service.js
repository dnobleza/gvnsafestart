const { Prisma } = require('@prisma/client');
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const branchRepository = require('../repositories/branch.repository');
const auditService = require('./audit.service');

const toBranch = (branch) => ({
  id: branch.id,
  name: branch.name,
  isActive: branch.isActive,
  latitude: branch.latitude === null ? null : Number(branch.latitude),
  longitude: branch.longitude === null ? null : Number(branch.longitude),
  createdAt: branch.createdAt,
  instructorCount: branch._count.instructorProfiles,
});

const nameTaken = () => AppError.conflict('BRANCH_NAME_TAKEN', 'A branch with that name already exists');

const isUniqueViolation = (err) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

const assertNameFree = async (name, exceptId, client) => {
  const existing = await branchRepository.findByNameInsensitive(name, client);
  if (existing && existing.id !== exceptId) throw nameTaken();
};

const list = async ({ status, page, limit }) => {
  const { rows, total } = await branchRepository.list({ status, page, limit });
  return { data: rows.map(toBranch), meta: { page, limit, total } };
};

const options = () => branchRepository.listActiveOptions();

const create = async (actor, { name, latitude, longitude }, meta) => {
  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertNameFree(name, null, tx);
      const branch = await branchRepository.create({ name, latitude, longitude }, tx);
      await auditService.record(tx, {
        actor,
        action: 'BRANCH_CREATED',
        targetType: 'BRANCH',
        targetId: branch.id,
        metadata: { name, latitude, longitude },
        meta,
      });
      return branch;
    });
    return { branch: toBranch(created) };
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
};

const update = async (id, actor, input, meta) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await branchRepository.findById(id, tx);
      if (!target) throw AppError.notFound('BRANCH_NOT_FOUND', 'Branch not found');

      const changes = {};
      if (input.name !== undefined && input.name !== target.name) {
        await assertNameFree(input.name, id, tx);
        changes.name = { from: target.name, to: input.name };
      }
      if (input.isActive !== undefined && input.isActive !== target.isActive) {
        changes.isActive = { from: target.isActive, to: input.isActive };
      }
      if (
        input.latitude !== undefined &&
        (Number(target.latitude) !== input.latitude || Number(target.longitude) !== input.longitude || target.latitude === null)
      ) {
        changes.coordinates = {
          from: target.latitude === null ? null : [Number(target.latitude), Number(target.longitude)],
          to: [input.latitude, input.longitude],
        };
      }
      const becomesActive = changes.isActive ? input.isActive : target.isActive;
      const hasCoordinates = changes.coordinates || target.latitude !== null;
      if (changes.isActive && becomesActive && !hasCoordinates) {
        throw AppError.badRequest('BRANCH_COORDINATES_REQUIRED', 'Set the branch location on the map before activating it');
      }
      if (Object.keys(changes).length === 0) return target;

      const data = {};
      if (changes.name) data.name = input.name;
      if (changes.isActive) data.isActive = input.isActive;
      if (changes.coordinates) {
        data.latitude = input.latitude;
        data.longitude = input.longitude;
      }
      const branch = await branchRepository.update(id, data, tx);
      await auditService.record(tx, {
        actor,
        action: 'BRANCH_UPDATED',
        targetType: 'BRANCH',
        targetId: id,
        metadata: { changes },
        meta,
      });
      return branch;
    });
    return { branch: toBranch(result) };
  } catch (err) {
    if (isUniqueViolation(err)) throw nameTaken();
    throw err;
  }
};

module.exports = { list, options, create, update };
