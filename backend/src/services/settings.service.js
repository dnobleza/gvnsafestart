const prisma = require('../config/prisma');
const settingRepository = require('../repositories/setting.repository');
const auditService = require('./audit.service');

// Used whenever a key has no row yet, e.g. a fresh database before seeding.
const DEFAULTS = Object.freeze({
  clientChangeCutoffHours: 24,
  onlinePaymentExpiryMinutes: 30,
  cashAutoCancelHours: 12,
  pricePerHour: 800,
  reservationFee: 1000,
});

const CACHE_MS = 30000;
let cache = null;

const load = async () => {
  const rows = await settingRepository.findAll();
  const values = { ...DEFAULTS };
  for (const row of rows) if (row.key in DEFAULTS) values[row.key] = row.value;
  return values;
};

const get = async () => {
  if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), values: await load() };
  return cache.values;
};

const clearCache = () => {
  cache = null;
};

const update = async (actor, changes, meta) => {
  const before = await load();
  await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(changes)) {
      await settingRepository.upsert(key, value, actor.id, tx);
    }
    await auditService.record(tx, {
      actor,
      action: 'SETTINGS_UPDATED',
      targetType: 'SETTINGS',
      targetId: 'app',
      metadata: {
        changes: Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, { from: before[k], to: v }])),
      },
      meta,
    });
  });
  clearCache();
  return get();
};

module.exports = { DEFAULTS, get, update, clearCache };
