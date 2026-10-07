const prisma = require('../config/prisma');

const create = (data, client = prisma) => client.authIdentity.create({ data });

const findByProviderId = (provider, providerUserId) =>
  prisma.authIdentity.findUnique({
    where: { provider_providerUserId: { provider, providerUserId } },
  });

module.exports = { create, findByProviderId };
