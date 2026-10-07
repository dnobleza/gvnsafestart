const prisma = require('../config/prisma');

const listAreas = ({ activeOnly = true } = {}, client = prisma) =>
  client.serviceArea.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

const findArea = (id, client = prisma) => client.serviceArea.findUnique({ where: { id } });

const updateArea = (id, data, client = prisma) => client.serviceArea.update({ where: { id }, data });

const listPackages = ({ activeOnly = true } = {}, client = prisma) =>
  client.package.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

const findPackage = (id, client = prisma) => client.package.findUnique({ where: { id } });

const findPackageByCode = (code, client = prisma) => client.package.findUnique({ where: { code } });

const createPackage = (data, client = prisma) => client.package.create({ data });

const updatePackage = (id, data, client = prisma) => client.package.update({ where: { id }, data });

const listRates = (filters = {}, client = prisma) => client.packageRate.findMany({ where: filters });

const findRate = ({ packageId, serviceAreaId, trainingType }, client = prisma) =>
  client.packageRate.findUnique({
    where: { packageId_serviceAreaId_trainingType: { packageId, serviceAreaId, trainingType } },
  });

const upsertRate = ({ packageId, serviceAreaId, trainingType, price }, client = prisma) =>
  client.packageRate.upsert({
    where: { packageId_serviceAreaId_trainingType: { packageId, serviceAreaId, trainingType } },
    update: { price },
    create: { packageId, serviceAreaId, trainingType, price },
  });

const deleteRate = ({ packageId, serviceAreaId, trainingType }, client = prisma) =>
  client.packageRate.deleteMany({ where: { packageId, serviceAreaId, trainingType } });

module.exports = {
  listAreas,
  findArea,
  updateArea,
  listPackages,
  findPackage,
  findPackageByCode,
  createPackage,
  updatePackage,
  listRates,
  findRate,
  upsertRate,
  deleteRate,
};
