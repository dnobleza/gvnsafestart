const { z } = require('zod');
const { pagination, isoDate, idParams, emptyQuery, duration } = require('./common');

const locationsSchema = emptyQuery;

const instructorsSchema = {
  query: z
    .object({
      ...pagination,
      locationId: z.string().uuid().optional(),
      search: z.string().trim().min(1).max(120).optional(),
    })
    .strict(),
};

const recommendedSchema = {
  query: z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      date: isoDate,
      duration: duration.default(60),
    })
    .strict(),
};

const slotsSchema = {
  ...idParams,
  query: z.object({ date: isoDate, duration: duration.default(60) }).strict(),
};

const trainingType = z.enum(['OWN_CAR', 'CAR_RENTAL']);

const instructorSchema = { ...idParams, ...emptyQuery };

const topSchema = emptyQuery;

const serviceAreasSchema = emptyQuery;

const packagesSchema = {
  query: z
    .object({ serviceAreaId: z.string().uuid().optional(), trainingType: trainingType.optional() })
    .strict(),
};

module.exports = {
  trainingType,
  locationsSchema,
  serviceAreasSchema,
  packagesSchema,
  instructorsSchema,
  instructorSchema,
  topSchema,
  recommendedSchema,
  slotsSchema,
};
