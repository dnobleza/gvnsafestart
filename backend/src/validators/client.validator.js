const { z } = require('zod');
const { pagination, idParams, emptyBody, emptyQuery, futureDateTime, reason, duration } = require('./common');
const { fullName, phone } = require('./auth.validator');

const LESSON_TYPES = ['Basic Driving', 'Defensive Driving', 'Highway Practice', 'Parking Skills', 'Night Driving'];

const dashboardSchema = emptyQuery;

const createBookingSchema = {
  body: z
    .object({
      instructorId: z.string().uuid(),
      scheduledAt: futureDateTime,
      durationMinutes: duration,
      lessonType: z.enum(LESSON_TYPES),
      paymentMethod: z.enum(['ONLINE', 'CASH']),
      area: z.string().trim().min(1).max(120).optional(),
      notes: z.string().trim().min(1).max(500).optional(),
    })
    .strict(),
};

const bookingsListSchema = {
  query: z.object({ ...pagination, tab: z.enum(['upcoming', 'past', 'cancelled']).default('upcoming') }).strict(),
};

const bookingGetSchema = { ...idParams, ...emptyQuery };

const cancelSchema = { ...idParams, body: z.object({ reason }).strict() };

const rescheduleSchema = { ...idParams, body: z.object({ scheduledAt: futureDateTime, reason }).strict() };

const paySchema = { ...idParams, ...emptyBody };

const ratingSchema = {
  ...idParams,
  body: z
    .object({
      stars: z.number().int().min(1).max(5),
      comment: z.string().trim().max(500).optional().transform((v) => v || undefined),
    })
    .strict(),
};

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const savedLocation = z
  .object({
    city: z.string().trim().min(1).max(120).optional(),
    latitude: latitude.optional(),
    longitude: longitude.optional(),
  })
  .strict()
  .refine((l) => (l.latitude === undefined) === (l.longitude === undefined), {
    message: 'Send latitude and longitude together',
  })
  .refine((l) => l.city || l.latitude !== undefined, { message: 'Give a city or coordinates' });

const packagesListSchema = { query: z.object({ ...pagination }).strict() };

const packageGetSchema = { ...idParams, ...emptyQuery };

const purchaseSchema = {
  body: z
    .object({
      packageId: z.string().uuid(),
      serviceAreaId: z.string().uuid(),
      trainingType: z.enum(['OWN_CAR', 'CAR_RENTAL']),
      instructorId: z.string().uuid(),
      scheduledAt: futureDateTime,
      pickupAddress: z.string().trim().min(5, 'Enter the full pickup address').max(300),
      paymentMethod: z.enum(['ONLINE', 'CASH']),
    })
    .strict(),
};

const nextSessionSchema = { ...idParams, body: z.object({ scheduledAt: futureDateTime }).strict() };

const packagePaySchema = { ...idParams, ...emptyBody };

const packageCancelSchema = { ...idParams, body: z.object({ reason }).strict() };

const profileGetSchema = emptyQuery;

const profileUpdateSchema = {
  body: z
    .object({ fullName: fullName.optional(), phone: phone.optional(), savedLocation: savedLocation.nullable().optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' }),
};

module.exports = {
  LESSON_TYPES,
  latitude,
  longitude,
  dashboardSchema,
  createBookingSchema,
  bookingsListSchema,
  bookingGetSchema,
  cancelSchema,
  rescheduleSchema,
  paySchema,
  ratingSchema,
  profileGetSchema,
  profileUpdateSchema,
  packagesListSchema,
  packageGetSchema,
  purchaseSchema,
  nextSessionSchema,
  packagePaySchema,
  packageCancelSchema,
};
