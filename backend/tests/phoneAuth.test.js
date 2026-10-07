const request = require('supertest');
const logger = require('../src/config/logger');
const app = require('../src/app');
const { prisma, resetDb, createUser } = require('./helpers');

const PHONE = '+639170000001';

// The console SMS sender writes through winston, so spying on the logger is how
// a test reads the code a real user would read off their phone.
let logSpy;

const lastCode = () => {
  const line = logSpy.mock.calls.map(([msg]) => msg).reverse().find((m) => m.includes('[sms:console]'));
  return line ? line.match(/code is (\d+)/)[1] : null;
};

const requestOtp = (phone = PHONE) =>
  request(app).post('/api/v1/auth/phone/request-otp').send({ phone });

const verifyOtp = (body) => request(app).post('/api/v1/auth/phone/verify-otp').send(body);

beforeEach(async () => {
  await resetDb();
  logSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
});

afterEach(() => logSpy.mockRestore());
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/phone/request-otp', () => {
  it('stores only a hash of the code', async () => {
    await requestOtp().expect(200);

    const otp = await prisma.phoneOtp.findFirst();
    expect(otp.codeHash).not.toBe(lastCode());
    expect(otp.codeHash.startsWith('$2')).toBe(true);
  });

  it('answers the same for an unknown number as for a known one', async () => {
    const unknown = await requestOtp('+639179999999');
    await createUser({ email: null, phone: PHONE });
    const known = await requestOtp();

    expect(unknown.status).toBe(200);
    expect(known.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('rejects a non-E.164 number', async () => {
    const res = await requestOtp('09171234567');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalidates an earlier unused code', async () => {
    await requestOtp().expect(200);
    const first = lastCode();
    await requestOtp().expect(200);

    const res = await verifyOtp({ phone: PHONE, code: first });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/phone/verify-otp', () => {
  it('creates the account and signs in a brand new number', async () => {
    await requestOtp().expect(200);

    const res = await verifyOtp({ phone: PHONE, code: lastCode(), fullName: 'Phone User' });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.phone).toBe(PHONE);

    const row = await prisma.registration.findFirst();
    expect(row.provider).toBe('PHONE');
    expect(row.phone).toBe(PHONE);
    expect(row.email).toBeNull();
    expect(row.passwordHash).toBeNull();
    expect(row.role).toBe('CLIENT');

    expect(await prisma.user.count()).toBe(1);
  });

  it('logs in an existing phone account', async () => {
    await createUser({ email: null, phone: PHONE, password: null });
    await requestOtp().expect(200);

    const res = await verifyOtp({ phone: PHONE, code: lastCode() });

    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe(PHONE);
    expect(typeof res.body.data.accessToken).toBe('string');
  });

  it('counts a wrong code as an attempt', async () => {
    await requestOtp().expect(200);

    const res = await verifyOtp({ phone: PHONE, code: '000000' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_OTP');
    expect((await prisma.phoneOtp.findFirst()).attempts).toBe(1);
  });

  it('burns the code once the attempt cap is hit', async () => {
    await requestOtp().expect(200);
    const code = lastCode();
    await prisma.phoneOtp.updateMany({ data: { attempts: 5 } });

    const res = await verifyOtp({ phone: PHONE, code });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_ATTEMPTS_EXCEEDED');
    expect((await prisma.phoneOtp.findFirst()).consumedAt).not.toBeNull();
  });

  it('rejects an expired code', async () => {
    await requestOtp().expect(200);
    const code = lastCode();
    await prisma.phoneOtp.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await verifyOtp({ phone: PHONE, code });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('cannot reuse a consumed code', async () => {
    await createUser({ email: null, phone: PHONE, password: null });
    await requestOtp().expect(200);
    const code = lastCode();

    await verifyOtp({ phone: PHONE, code }).expect(200);
    const replay = await verifyOtp({ phone: PHONE, code });

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('OTP_EXPIRED');
  });
});
