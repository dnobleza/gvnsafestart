const { z } = require('zod');

const listSchema = {
  query: z
    .object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(20),
    })
    .strict(),
};

const idSchema = {
  params: z.object({ id: z.string().uuid() }).strict(),
};

module.exports = { listSchema, idSchema };
