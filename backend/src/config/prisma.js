const { PrismaClient } = require('@prisma/client');
const config = require('./index');

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ||
  new PrismaClient({
    log: config.isProduction ? ['error'] : ['warn', 'error'],
  });

if (!config.isProduction) {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
