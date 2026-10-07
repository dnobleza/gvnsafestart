const prisma = require('../config/prisma');

// ON CONFLICT DO NOTHING: returns 0 for an event already stored, without
// aborting the surrounding transaction the way a unique violation would.
const record = async ({ provider, eventId, type }, client = prisma) => {
  const { count } = await client.paymentEvent.createMany({
    data: [{ provider, eventId, type }],
    skipDuplicates: true,
  });
  return count === 1;
};

module.exports = { record };
