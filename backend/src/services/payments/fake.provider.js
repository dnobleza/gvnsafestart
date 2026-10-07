const crypto = require('crypto');
const config = require('../../config');

const NAME = 'FAKE';

// Development stand-in: no money moves. The "checkout" sends the client
// straight back; payment is confirmed only by a signed webhook, e.g. from
// `npm run payments:simulate`, exactly like the real provider.
const createCheckout = async ({ bookingId }) => ({
  reference: `fake_cs_${crypto.randomUUID()}`,
  checkoutUrl: `${config.appBaseUrl}/client/bookings/${bookingId}?payment=return`,
});

module.exports = { NAME, createCheckout, webhookSecret: () => config.payments.fakeWebhookSecret };
