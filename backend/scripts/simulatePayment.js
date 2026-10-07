// Development helper: sends a signed "checkout_session.payment.paid" webhook
// for a booking's open checkout to the running API, the same way the provider
// would. Usage: npm run payments:simulate -- <bookingId> [eventId]
const crypto = require('crypto');
const config = require('../src/config');
const prisma = require('../src/config/prisma');
const providers = require('../src/services/payments');
const signature = require('../src/services/payments/signature');

const main = async () => {
  if (config.isProduction) throw new Error('Refusing to simulate payments in production');
  const [bookingId, eventId = `evt_sim_${crypto.randomUUID()}`] = process.argv.slice(2);
  if (!bookingId) throw new Error('Usage: npm run payments:simulate -- <bookingId> [eventId]');

  const provider = providers.active();
  const payment = await prisma.payment.findFirst({
    where: { bookingId, provider: provider.NAME, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment) throw new Error('No open checkout for that booking. Click "Pay now" first.');

  const rawBody = JSON.stringify({
    data: {
      id: eventId,
      type: 'event',
      attributes: {
        type: 'checkout_session.payment.paid',
        livemode: false,
        data: { id: payment.providerReference, type: 'checkout_session', attributes: {} },
      },
    },
  });
  const res = await fetch(`http://localhost:${config.port}/api/v1/payments/webhooks/paymongo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Paymongo-Signature': signature.header(provider.webhookSecret(), rawBody),
    },
    body: rawBody,
  });
  process.stdout.write(`${res.status} ${await res.text()}\n`);
};

main()
  .catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
