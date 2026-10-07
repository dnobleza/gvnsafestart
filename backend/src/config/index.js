require('dotenv').config();
const { z } = require('zod');

// dotenv turns an unset `FOO=` line into '', not undefined, so an .optional()
// string would still fail min(1). Treat blank as absent.
const optionalString = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  CORS_ORIGIN: z.string().url(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  PUBLIC_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  GOOGLE_CLIENT_ID: optionalString,
  FACEBOOK_APP_ID: optionalString,
  FACEBOOK_APP_SECRET: optionalString,

  OTP_TTL_SECONDS: z.coerce.number().int().min(60).max(1800).default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),
  OTP_LENGTH: z.coerce.number().int().min(4).max(8).default(6),
  OTP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  SMS_PROVIDER: z.enum(['console']).default('console'),

  EMAIL_PROVIDER: z.enum(['console', 'smtp']).default('console'),
  EMAIL_FROM: z.string().min(1).default('GVN-Safestart <no-reply@gvnsafestart.local>'),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,

  PAYMENT_PROVIDER: z.enum(['paymongo', 'fake']).default('fake'),
  PAYMONGO_SECRET_KEY: optionalString,
  PAYMONGO_WEBHOOK_SECRET: optionalString,
  PAYMONGO_API_BASE: z.string().url().default('https://api.paymongo.com/v1'),
  FAKE_PAYMENT_WEBHOOK_SECRET: z.string().min(16).default('fake-webhook-secret-for-dev-only'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),

  GEOCODER_PROVIDER: z.enum(['nominatim', 'off']).default('nominatim'),
  GEOCODER_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  GEOCODER_CONTACT_EMAIL: optionalString,

  APP_TIMEZONE: z.string().default('Asia/Manila'),
  SEED_ADMIN_EMAIL: optionalString,
  SEED_ADMIN_PASSWORD: optionalString,
});

const parsed = envSchema
  .refine((e) => e.EMAIL_PROVIDER !== 'smtp' || e.SMTP_HOST, {
    path: ['SMTP_HOST'],
    message: 'SMTP_HOST is required when EMAIL_PROVIDER=smtp',
  })
  .refine((e) => e.PAYMENT_PROVIDER !== 'paymongo' || (e.PAYMONGO_SECRET_KEY && e.PAYMONGO_WEBHOOK_SECRET), {
    path: ['PAYMONGO_SECRET_KEY'],
    message: 'PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET are required when PAYMENT_PROVIDER=paymongo',
  })
  .refine((e) => e.PAYMENT_PROVIDER !== 'fake' || e.NODE_ENV !== 'production', {
    path: ['PAYMENT_PROVIDER'],
    message: 'The fake payment provider cannot be used in production',
  })
  .safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}\n\nSee Environment variables in README.md`);
}

const env = parsed.data;

module.exports = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwt: Object.freeze({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessTtl: env.JWT_ACCESS_TTL,
    refreshTtl: env.JWT_REFRESH_TTL,
  }),
  cors: Object.freeze({ origin: env.CORS_ORIGIN }),
  rateLimit: Object.freeze({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    publicMax: env.PUBLIC_RATE_LIMIT_MAX,
  }),
  bcryptRounds: env.BCRYPT_ROUNDS,
  logLevel: env.LOG_LEVEL,
  google: Object.freeze({ clientId: env.GOOGLE_CLIENT_ID }),
  facebook: Object.freeze({ appId: env.FACEBOOK_APP_ID, appSecret: env.FACEBOOK_APP_SECRET }),
  otp: Object.freeze({
    ttlSeconds: env.OTP_TTL_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    length: env.OTP_LENGTH,
    rateLimitMax: env.OTP_RATE_LIMIT_MAX,
  }),
  smsProvider: env.SMS_PROVIDER,
  email: Object.freeze({
    provider: env.EMAIL_PROVIDER,
    from: env.EMAIL_FROM,
    smtp: Object.freeze({ host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, pass: env.SMTP_PASS }),
  }),
  timezone: env.APP_TIMEZONE,
  appBaseUrl: env.APP_BASE_URL,
  apiPublicUrl: env.API_PUBLIC_URL.replace(/\/+$/, ''),
  geocoder: Object.freeze({
    provider: env.GEOCODER_PROVIDER,
    baseUrl: env.GEOCODER_BASE_URL.replace(/\/+$/, ''),
    contactEmail: env.GEOCODER_CONTACT_EMAIL,
  }),
  payments: Object.freeze({
    provider: env.PAYMENT_PROVIDER,
    paymongo: Object.freeze({
      secretKey: env.PAYMONGO_SECRET_KEY,
      webhookSecret: env.PAYMONGO_WEBHOOK_SECRET,
      apiBase: env.PAYMONGO_API_BASE,
    }),
    fakeWebhookSecret: env.FAKE_PAYMENT_WEBHOOK_SECRET,
  }),
  seedAdmin: Object.freeze({ email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD }),
});
