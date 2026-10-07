const { z } = require('zod');

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Not a real calendar date');

const withDateOrder = (schema) =>
  schema.refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: '"to" must not be before "from"',
  });

const idParams = { params: z.object({ id: z.string().uuid() }).strict() };

const emptyBody = { body: z.object({}).strip() };

const emptyQuery = { query: z.object({}).strict() };

const futureDateTime = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now(), 'Must be in the future');

const reason = z.string().trim().min(1, 'A reason is required').max(500);

const bookingStatus = z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'NO_SHOW', 'CANCELLED']);

// Minutes. Package sessions run 5 or 12 hours; legacy lessons 60-120 minutes.
const duration = z.coerce
  .number()
  .int()
  .min(60, 'Duration must be at least 60 minutes')
  .max(720, 'Duration must be at most 12 hours')
  .refine((v) => v % 30 === 0, 'Duration must be in 30-minute steps');

module.exports = {
  pagination,
  isoDate,
  withDateOrder,
  idParams,
  emptyBody,
  emptyQuery,
  futureDateTime,
  reason,
  bookingStatus,
  duration,
};
