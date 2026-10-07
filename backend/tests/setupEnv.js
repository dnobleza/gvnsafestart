const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Only TEST_DATABASE_URL is taken from backend/.env, so the dev DATABASE_URL
// can never be picked up by the test run.
function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const envFile = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envFile)) return dotenv.parse(fs.readFileSync(envFile)).TEST_DATABASE_URL;
  return undefined;
}

const databaseUrl = testDatabaseUrl();
if (!databaseUrl) {
  throw new Error('TEST_DATABASE_URL is not set (see Environment variables in README.md)');
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret-value';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-value';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.RATE_LIMIT_MAX = '1000';
process.env.PUBLIC_RATE_LIMIT_MAX = '100000';
process.env.BCRYPT_ROUNDS = '10';
process.env.OTP_TTL_SECONDS = '300';
process.env.OTP_RATE_LIMIT_MAX = '1000';
process.env.SMS_PROVIDER = 'console';
process.env.EMAIL_PROVIDER = 'console';
process.env.PAYMENT_PROVIDER = 'paymongo';
process.env.PAYMONGO_SECRET_KEY = 'sk_test_unit';
process.env.PAYMONGO_WEBHOOK_SECRET = 'whsk_test_unit_secret';
process.env.PAYMONGO_API_BASE = 'https://paymongo.test/v1';
process.env.APP_BASE_URL = 'http://localhost:5173';
process.env.API_PUBLIC_URL = 'https://api.example.test';
process.env.GEOCODER_PROVIDER = 'nominatim';
process.env.GEOCODER_BASE_URL = 'https://geo.example.test';
process.env.GEOCODER_CONTACT_EMAIL = 'ops@example.test';
process.env.ENABLE_CRON = 'false';
process.env.CRON_SECRET = 'cron-test-secret-value';
