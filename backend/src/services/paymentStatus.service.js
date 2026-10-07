const config = require('../config');
const prisma = require('../config/prisma');
const auditService = require('./audit.service');
const { PAID_EVENT } = require('./onlinePayment.service');

const WEBHOOK_PATH = '/api/v1/payments/webhooks/paymongo';

const modeOf = () => {
  if (config.payments.provider === 'fake') return 'fake';
  const key = config.payments.paymongo.secretKey || '';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
};

const isLocal = (url) => ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);

// What an admin needs to connect PayMongo. The keys themselves stay in the
// server environment and are never sent to the browser.
const status = () => {
  const webhookUrl = `${config.apiPublicUrl}${WEBHOOK_PATH}`;
  return {
    provider: config.payments.provider,
    mode: modeOf(),
    secretKeySet: Boolean(config.payments.paymongo.secretKey),
    webhookSecretSet: Boolean(config.payments.paymongo.webhookSecret),
    webhookUrl,
    webhookEvent: PAID_EVENT,
    webhookUrlIsLocal: isLocal(webhookUrl),
    returnUrl: config.appBaseUrl,
  };
};

const checkPaymongo = async (expectedUrl) => {
  const { apiBase, secretKey } = config.payments.paymongo;
  let res;
  try {
    res = await fetch(`${apiBase}/webhooks`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return { ok: false, keyValid: null, message: `Could not reach PayMongo: ${err.message}` };
  }
  if (res.status === 401 || res.status === 403) {
    return { ok: false, keyValid: false, message: 'PayMongo rejected the secret key. Check PAYMONGO_SECRET_KEY.' };
  }
  if (!res.ok) return { ok: false, keyValid: null, message: `PayMongo responded with HTTP ${res.status}.` };

  const body = await res.json().catch(() => ({}));
  const hooks = (body.data || []).map((h) => h.attributes || {});
  const match = hooks.find((h) => h.url === expectedUrl);
  const webhookEnabled = Boolean(match && match.status === 'enabled');
  const hasPaidEvent = Boolean(match && (match.events || []).includes(PAID_EVENT));
  const ok = webhookEnabled && hasPaidEvent;
  let message = 'Connected: the key works and the webhook is set up.';
  if (!match) message = `The key works, but no PayMongo webhook points at ${expectedUrl}. Create one in the PayMongo dashboard.`;
  else if (!webhookEnabled) message = 'The webhook exists but is disabled in PayMongo.';
  else if (!hasPaidEvent) message = `The webhook exists but does not send ${PAID_EVENT}.`;
  return {
    ok,
    keyValid: true,
    webhookFound: Boolean(match),
    webhookEnabled,
    hasPaidEvent,
    otherWebhookUrls: hooks.filter((h) => h !== match).map((h) => h.url),
    message,
  };
};

const test = async (actor, meta) => {
  const current = status();
  const result =
    current.provider === 'fake'
      ? { ok: false, keyValid: null, message: 'Using the fake provider for development. Set PAYMENT_PROVIDER=paymongo to take real payments.' }
      : !current.secretKeySet || !current.webhookSecretSet
        ? { ok: false, keyValid: false, message: 'PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET must both be set.' }
        : await checkPaymongo(current.webhookUrl);

  await prisma.$transaction((tx) =>
    auditService.record(tx, {
      actor,
      action: 'PAYMENT_PROVIDER_TESTED',
      targetType: 'SETTINGS',
      targetId: 'payments',
      metadata: { provider: current.provider, mode: current.mode, ok: result.ok, message: result.message },
      meta,
    }),
  );
  return { ...current, result };
};

module.exports = { status, test };
