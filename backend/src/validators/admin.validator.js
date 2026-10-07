const { z } = require('zod');
const { email, fullName } = require('./auth.validator');
const {
  pagination,
  isoDate,
  withDateOrder,
  idParams,
  emptyBody,
  futureDateTime,
  reason,
  bookingStatus,
} = require('./common');

const clientTerm = z.string().trim().min(1).max(120);

const overviewSchema = { query: z.object({}).strict() };

const paymentsListSchema = {
  query: withDateOrder(
    z
      .object({
        ...pagination,
        status: z.enum(['PAID', 'PENDING', 'FAILED', 'REFUNDED', 'VOIDED']).optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        client: clientTerm.optional(),
      })
      .strict(),
  ),
};

const bookingsListSchema = {
  query: withDateOrder(
    z
      .object({
        ...pagination,
        status: bookingStatus.optional(),
        from: isoDate.optional(),
        to: isoDate.optional(),
        client: clientTerm.optional(),
        instructorId: z.string().uuid().optional(),
        branchId: z.string().uuid().optional(),
        actionBy: z.enum(['ADMIN', 'INSTRUCTOR', 'CLIENT']).optional(),
      })
      .strict(),
  ),
};

const approveBookingSchema = { ...idParams, ...emptyBody };

const rescheduleBookingSchema = {
  ...idParams,
  body: z
    .object({ scheduledAt: futureDateTime, reason })
    .strict(),
};

const cancelBookingSchema = {
  ...idParams,
  body: z.object({ reason }).strict(),
};

const bookingHistorySchema = { ...idParams, query: z.object({}).strict() };

const ratingsListSchema = {
  query: z
    .object({
      ...pagination,
      instructorId: z.string().uuid().optional(),
      branchId: z.string().uuid().optional(),
    })
    .strict(),
};

const hideRatingSchema = { ...idParams, body: z.object({ hidden: z.boolean() }).strict() };

const voidRequestListSchema = {
  query: z
    .object({ ...pagination, status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional() })
    .strict(),
};

const reviewVoidSchema = { ...idParams, body: z.object({ decision: z.enum(['APPROVE', 'REJECT']) }).strict() };

const statusFilter = z.enum(['active', 'inactive', 'all']).default('all');

const addressText = z.string().trim().min(1).max(200);
const address = z
  .object({ street: addressText, barangay: addressText, city: addressText, province: addressText })
  .strict();

const branchName = z.string().trim().min(1).max(120);

const instructorListSchema = {
  query: z
    .object({ ...pagination, status: statusFilter, branchId: z.string().uuid().optional() })
    .strict(),
};

const instructorGetSchema = { ...idParams, query: z.object({}).strict() };

const createInstructorSchema = {
  body: z.object({ fullName, email, address, branchId: z.string().uuid() }).strict(),
};

const updateInstructorSchema = {
  ...idParams,
  body: z
    .object({ fullName: fullName.optional(), address: address.optional(), branchId: z.string().uuid().optional() })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' }),
};

const adminListSchema = {
  query: z.object({ ...pagination, status: statusFilter }).strict(),
};

const createAdminSchema = { body: z.object({ fullName, email }).strict() };

const accountActionSchema = { ...idParams, ...emptyBody };

const branchListSchema = {
  query: z.object({ ...pagination, status: statusFilter }).strict(),
};

const branchOptionsSchema = { query: z.object({}).strict() };

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);
const pairedCoordinates = (b) => (b.latitude === undefined) === (b.longitude === undefined);
const PAIR_MESSAGE = { path: ['longitude'], message: 'Send latitude and longitude together' };

// A new branch is active straight away, so it needs a map position.
const createBranchSchema = { body: z.object({ name: branchName, latitude, longitude }).strict() };

const updateBranchSchema = {
  ...idParams,
  body: z
    .object({
      name: branchName.optional(),
      isActive: z.boolean().optional(),
      latitude: latitude.optional(),
      longitude: longitude.optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' })
    .refine(pairedCoordinates, PAIR_MESSAGE),
};

const trainingType = z.enum(['OWN_CAR', 'CAR_RENTAL']);

const packageFields = {
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).nullable(),
  sessions: z.number().int().min(1).max(20),
  hoursPerSession: z.number().int().min(1).max(12),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(1000),
};

const packagesAdminListSchema = { query: z.object({}).strict() };

const createPackageSchema = {
  body: z
    .object({
      code: z.string().trim().regex(/^[A-Z0-9_]{2,40}$/, 'Use capitals, digits and underscores'),
      name: packageFields.name,
      description: packageFields.description.optional(),
      sessions: packageFields.sessions,
      hoursPerSession: packageFields.hoursPerSession,
      sortOrder: packageFields.sortOrder.optional(),
    })
    .strict(),
};

const updatePackageSchema = {
  ...idParams,
  body: z
    .object(Object.fromEntries(Object.entries(packageFields).map(([k, v]) => [k, v.optional()])))
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' }),
};

const rateGridSchema = { query: z.object({ trainingType: trainingType.default('OWN_CAR') }).strict() };

const saveRatesSchema = {
  body: z
    .object({
      trainingType,
      rates: z
        .array(
          z
            .object({
              packageId: z.string().uuid(),
              serviceAreaId: z.string().uuid(),
              price: z.number().positive().max(1000000).nullable(),
            })
            .strict(),
        )
        .max(500),
    })
    .strict(),
};

const serviceAreasAdminListSchema = { query: z.object({}).strict() };

const updateServiceAreaSchema = {
  ...idParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(1000).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' }),
};

const settingsGetSchema = { query: z.object({}).strict() };

const paymentProviderTestSchema = { ...emptyBody };

const settingsUpdateSchema = {
  body: z
    .object({
      clientChangeCutoffHours: z.number().int().min(0).max(168).optional(),
      onlinePaymentExpiryMinutes: z.number().int().min(5).max(1440).optional(),
      cashAutoCancelHours: z.number().int().min(0).max(168).optional(),
      pricePerHour: z.number().positive().max(100000).optional(),
      reservationFee: z.number().min(0).max(100000).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one setting to update' }),
};

const auditListSchema = {
  query: z
    .object({
      ...pagination,
      action: z.string().trim().min(1).max(60).optional(),
      actorId: z.string().uuid().optional(),
    })
    .strict(),
};

module.exports = {
  overviewSchema,
  paymentsListSchema,
  bookingsListSchema,
  approveBookingSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  bookingHistorySchema,
  ratingsListSchema,
  hideRatingSchema,
  voidRequestListSchema,
  reviewVoidSchema,
  instructorListSchema,
  instructorGetSchema,
  createInstructorSchema,
  updateInstructorSchema,
  adminListSchema,
  createAdminSchema,
  accountActionSchema,
  branchListSchema,
  branchOptionsSchema,
  createBranchSchema,
  updateBranchSchema,
  settingsGetSchema,
  settingsUpdateSchema,
  paymentProviderTestSchema,
  packagesAdminListSchema,
  createPackageSchema,
  updatePackageSchema,
  rateGridSchema,
  saveRatesSchema,
  serviceAreasAdminListSchema,
  updateServiceAreaSchema,
  auditListSchema,
};
