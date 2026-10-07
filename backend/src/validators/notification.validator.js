const { z } = require('zod');
const { pagination, idParams, emptyBody } = require('./common');

const listSchema = {
  query: z
    .object({ ...pagination, unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional() })
    .strict(),
};

const readSchema = { ...idParams, ...emptyBody };

const readAllSchema = emptyBody;

module.exports = { listSchema, readSchema, readAllSchema };
