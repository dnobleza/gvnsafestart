const config = require('../../config');
const AppError = require('../../utils/AppError');

const NAME = 'PAYMONGO';

const authHeader = () => `Basic ${Buffer.from(`${config.payments.paymongo.secretKey}:`).toString('base64')}`;

const createCheckout = async ({ bookingId, amount, description, successUrl, cancelUrl }) => {
  const res = await fetch(`${config.payments.paymongo.apiBase}/checkout_sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: authHeader() },
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ currency: 'PHP', amount: Math.round(Number(amount) * 100), name: description, quantity: 1 }],
          payment_method_types: ['gcash', 'paymaya', 'card'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          reference_number: bookingId,
          description,
          metadata: { bookingId },
          send_email_receipt: false,
          show_line_items: true,
        },
      },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !body.data) {
    throw new AppError('PAYMENT_PROVIDER_ERROR', 502, 'Could not start the online payment. Please try again.');
  }
  return { reference: body.data.id, checkoutUrl: body.data.attributes.checkout_url };
};

module.exports = { NAME, createCheckout, webhookSecret: () => config.payments.paymongo.webhookSecret };
