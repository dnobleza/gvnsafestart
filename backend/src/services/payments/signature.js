const crypto = require('crypto');

const TOLERANCE_SECONDS = 300;

const sign = (secret, timestamp, rawBody) =>
  crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');

const parseHeader = (header) =>
  Object.fromEntries(
    String(header || '')
      .split(',')
      .map((part) => part.trim().split('='))
      .filter(([k, v]) => k && v),
  );

const safeEqual = (a, b) => {
  const left = Buffer.from(a || '', 'utf8');
  const right = Buffer.from(b || '', 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// PayMongo-style header: "t=<unix seconds>,te=<test sig>,li=<live sig>". The
// signature covers "<t>.<raw body>", so the body must be the exact bytes
// received, and an old timestamp is refused to stop replays.
const verify = ({ secret, header, rawBody, livemode, now = Date.now() }) => {
  const parts = parseHeader(header);
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = sign(secret, parts.t, rawBody);
  return safeEqual(livemode ? parts.li : parts.te, expected);
};

const header = (secret, rawBody, { livemode = false, timestamp = Math.floor(Date.now() / 1000) } = {}) => {
  const sig = sign(secret, timestamp, rawBody);
  return livemode ? `t=${timestamp},te=,li=${sig}` : `t=${timestamp},te=${sig},li=`;
};

module.exports = { verify, header };
