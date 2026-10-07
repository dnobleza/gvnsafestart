const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const packageRepository = require('../repositories/package.repository');
const auditService = require('./audit.service');

const toPackage = (p) => ({
  id: p.id,
  code: p.code,
  name: p.name,
  description: p.description,
  sessions: p.sessions,
  hoursPerSession: p.hoursPerSession,
  isActive: p.isActive,
  sortOrder: p.sortOrder,
});

const toArea = (a) => ({ id: a.id, name: a.name, isActive: a.isActive, sortOrder: a.sortOrder });

const listPackages = async () => (await packageRepository.listPackages({ activeOnly: false })).map(toPackage);

const createPackage = async (actor, input, meta) => {
  const created = await prisma.$transaction(async (tx) => {
    if (await packageRepository.findPackageByCode(input.code, tx)) {
      throw AppError.conflict('PACKAGE_CODE_TAKEN', 'A package with that code already exists');
    }
    const row = await packageRepository.createPackage(input, tx);
    await auditService.record(tx, { actor, action: 'PACKAGE_CREATED', targetType: 'PACKAGE', targetId: row.id, metadata: input, meta });
    return row;
  });
  return toPackage(created);
};

const updatePackage = async (actor, id, input, meta) => {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await packageRepository.findPackage(id, tx);
    if (!before) throw AppError.notFound('PACKAGE_NOT_FOUND', 'Package not found');
    const row = await packageRepository.updatePackage(id, input, tx);
    const changes = Object.fromEntries(
      Object.entries(input)
        .filter(([k, v]) => before[k] !== v)
        .map(([k, v]) => [k, { from: before[k], to: v }]),
    );
    if (Object.keys(changes).length) {
      await auditService.record(tx, { actor, action: 'PACKAGE_UPDATED', targetType: 'PACKAGE', targetId: id, metadata: { changes }, meta });
    }
    return row;
  });
  return toPackage(updated);
};

const rateGrid = async ({ trainingType }) => {
  const [areas, packages, rates] = await Promise.all([
    packageRepository.listAreas({ activeOnly: false }),
    packageRepository.listPackages({ activeOnly: false }),
    packageRepository.listRates({ trainingType }),
  ]);
  return {
    trainingType,
    areas: areas.map(toArea),
    packages: packages.map(toPackage),
    rates: rates.map((r) => ({ packageId: r.packageId, serviceAreaId: r.serviceAreaId, price: Number(r.price).toFixed(2) })),
  };
};

// Each cell is a price, or null to remove the rate (that combination then
// can't be booked online). Only cells that actually change are written.
const saveRates = async (actor, { trainingType, rates }, meta) => {
  await prisma.$transaction(async (tx) => {
    const current = new Map(
      (await packageRepository.listRates({ trainingType }, tx)).map((r) => [`${r.packageId}:${r.serviceAreaId}`, Number(r.price)]),
    );
    const changes = [];
    for (const { packageId, serviceAreaId, price } of rates) {
      const key = `${packageId}:${serviceAreaId}`;
      const before = current.has(key) ? current.get(key) : null;
      if (before === price) continue;
      if (price === null) await packageRepository.deleteRate({ packageId, serviceAreaId, trainingType }, tx);
      else await packageRepository.upsertRate({ packageId, serviceAreaId, trainingType, price: price.toFixed(2) }, tx);
      changes.push({ packageId, serviceAreaId, from: before, to: price });
    }
    if (changes.length) {
      await auditService.record(tx, {
        actor,
        action: 'PACKAGE_RATES_UPDATED',
        targetType: 'PACKAGE_RATES',
        targetId: trainingType,
        metadata: { trainingType, changes },
        meta,
      });
    }
  });
  return rateGrid({ trainingType });
};

const listAreas = async () => (await packageRepository.listAreas({ activeOnly: false })).map(toArea);

const updateArea = async (actor, id, input, meta) => {
  const updated = await prisma.$transaction(async (tx) => {
    const before = await packageRepository.findArea(id, tx);
    if (!before) throw AppError.notFound('SERVICE_AREA_NOT_FOUND', 'Service area not found');
    const row = await packageRepository.updateArea(id, input, tx);
    await auditService.record(tx, {
      actor,
      action: 'SERVICE_AREA_UPDATED',
      targetType: 'SERVICE_AREA',
      targetId: id,
      metadata: { changes: Object.fromEntries(Object.entries(input).map(([k, v]) => [k, { from: before[k], to: v }])) },
      meta,
    });
    return row;
  });
  return toArea(updated);
};

module.exports = { listPackages, createPackage, updatePackage, rateGrid, saveRates, listAreas, updateArea };
