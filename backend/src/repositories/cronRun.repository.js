const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.cronRun.create({ data });

const finish = (id, data, client = prisma) => client.cronRun.update({ where: { id }, data: { ...data, finishedAt: new Date() } });

// Transaction-scoped, so the lock is released on commit or rollback even if
// the process dies; a second instance gets false and skips the run.
const tryLock = async (client, key) => {
  const [row] = await client.$queryRaw`SELECT pg_try_advisory_xact_lock(${key}::bigint) AS locked`;
  return row.locked;
};

const list = async ({ job, page, limit }) => {
  const where = { job };
  const [rows, total] = await Promise.all([
    prisma.cronRun.findMany({ where, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.cronRun.count({ where }),
  ]);
  return { rows, total };
};

const latest = (job) => prisma.cronRun.findFirst({ where: { job }, orderBy: [{ startedAt: 'desc' }, { id: 'desc' }] });

module.exports = { create, finish, tryLock, list, latest };
