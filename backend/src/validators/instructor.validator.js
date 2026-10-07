const { z } = require('zod');
const {
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
} = require('./common');

const MAX_SCHEDULE_DAYS = 42;
const DAY_MS = 86400000;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24-hour)');

const profileSchema = emptyQuery;

const dashboardSchema = emptyQuery;

const bookingsListSchema = {
  query: withDateOrder(
    z
      .object({
        ...pagination,
        status: bookingStatus.optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
      })
      .strict(),
  ),
};

const bookingGetSchema = { ...idParams, ...emptyQuery };

const bookingActionSchema = { ...idParams, ...emptyBody };

const rescheduleSchema = {
  ...idParams,
  body: z.object({ scheduledAt: futureDateTime, reason }).strict(),
};

const cancelSchema = { ...idParams, body: z.object({ reason }).strict() };

const correctNoShowSchema = { ...idParams, body: z.object({ reason }).strict() };

const cashSchema = {
  ...idParams,
  body: z
    .object({
      amount: z
        .union([z.number(), z.string().regex(/^\d+(\.\d{1,2})?$/, 'Amount must be a number with up to 2 decimals')])
        .transform((v) => Number(v).toFixed(2))
        .refine((v) => Number(v) > 0 && Number(v) <= 1000000, 'Amount must be between 0 and 1,000,000')
        .optional(),
    })
    .strict(),
};

const scheduleSchema = {
  query: z
    .object({ from: isoDate, to: isoDate })
    .strict()
    .refine((q) => q.from <= q.to, { path: ['to'], message: '"to" must not be before "from"' })
    .refine(
      (q) => (Date.parse(q.to) - Date.parse(q.from)) / DAY_MS < MAX_SCHEDULE_DAYS,
      { path: ['to'], message: `Range must be under ${MAX_SCHEDULE_DAYS} days` },
    ),
};

const slotsSchema = {
  query: z
    .object({ date: isoDate, duration: duration.optional(), bookingId: z.string().uuid().optional() })
    .strict(),
};

const clientsListSchema = { query: z.object({ ...pagination }).strict() };

const clientGetSchema = { ...idParams, ...emptyQuery };

const noteSchema = { ...idParams, body: z.object({ note: z.string().trim().min(1).max(2000) }).strict() };

const availabilityGetSchema = emptyQuery;

const window = z
  .object({ dayOfWeek: z.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm })
  .strict()
  .refine((w) => w.endTime > w.startTime, { path: ['endTime'], message: 'End must be after start' });

const availabilityPutSchema = {
  body: z
    .object({ weekly: z.array(window).max(50) })
    .strict()
    .refine(
      ({ weekly }) =>
        weekly.every((a, i) =>
          weekly.every(
            (b, j) => i === j || a.dayOfWeek !== b.dayOfWeek || a.endTime <= b.startTime || b.endTime <= a.startTime,
          ),
        ),
      { path: ['weekly'], message: 'Working hours on the same day must not overlap' },
    ),
};

const dayOffCreateSchema = {
  body: z.object({ date: isoDate, reason: z.string().trim().min(1).max(200).optional() }).strict(),
};

const dayOffDeleteSchema = { ...idParams, ...emptyBody };

const cashListSchema = {
  query: withDateOrder(
    z.object({ ...pagination, from: isoDate.optional(), to: isoDate.optional() }).strict(),
  ),
};

const voidRequestSchema = { ...idParams, body: z.object({ reason }).strict() };

const ratingsSchema = { query: z.object({ ...pagination }).strict() };

module.exports = {
  profileSchema,
  dashboardSchema,
  bookingsListSchema,
  bookingGetSchema,
  bookingActionSchema,
  rescheduleSchema,
  cancelSchema,
  correctNoShowSchema,
  cashSchema,
  scheduleSchema,
  slotsSchema,
  clientsListSchema,
  clientGetSchema,
  noteSchema,
  availabilityGetSchema,
  availabilityPutSchema,
  dayOffCreateSchema,
  dayOffDeleteSchema,
  cashListSchema,
  voidRequestSchema,
  ratingsSchema,
};
