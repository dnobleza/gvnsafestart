const auditLogRepository = require('../repositories/auditLog.repository');

const SENSITIVE_KEY = /password|hash|token|secret/i;

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!SENSITIVE_KEY.test(key)) out[key] = redact(inner);
    }
    return out;
  }
  return value;
};

// Takes the caller's transaction client so the audit row commits or rolls back
// together with the change it describes.
const record = (tx, { actor, action, targetType, targetId, metadata = {}, meta = {} }) =>
  auditLogRepository.create(
    {
      actorId: actor.id,
      actorEmail: actor.email || '',
      action,
      targetType,
      targetId,
      metadata: redact(metadata),
      ip: meta.ip || null,
      userAgent: meta.userAgent || null,
    },
    tx,
  );

const toRow = (log) => ({
  id: log.id,
  action: log.action,
  targetType: log.targetType,
  targetId: log.targetId,
  metadata: log.metadata,
  actorEmail: log.actorEmail,
  actor: log.actor ? { id: log.actor.id, fullName: log.actor.fullName } : null,
  ip: log.ip,
  createdAt: log.createdAt,
});

const list = async ({ action, actorId, page, limit }) => {
  const { rows, total } = await auditLogRepository.list({ action, actorId, page, limit });
  return { data: rows.map(toRow), meta: { page, limit, total } };
};

module.exports = { record, list };
