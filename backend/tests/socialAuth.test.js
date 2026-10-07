const request = require('supertest');

// Only the provider network call is faked. Everything downstream -- the
// identity lookup, the account creation, the linking -- runs for real.
jest.mock('../src/services/providers/google.verifier');
jest.mock('../src/services/providers/facebook.verifier');

const googleVerifier = require('../src/services/providers/google.verifier');
const facebookVerifier = require('../src/services/providers/facebook.verifier');
const AppError = require('../src/utils/AppError');
const app = require('../src/app');
const { prisma, resetDb, createUser } = require('./helpers');

const GOOGLE_PROFILE = {
  providerUserId: 'google-sub-123',
  email: 'social@test.local',
  fullName: 'Soc Ial',
};

const postGoogle = () => request(app).post('/api/v1/auth/google').send({ idToken: 'x'.repeat(20) });
const postFacebook = () =>
  request(app).post('/api/v1/auth/facebook').send({ accessToken: 'y'.repeat(20) });

beforeEach(async () => {
  await resetDb();
  jest.resetAllMocks();
  googleVerifier.verify.mockResolvedValue(GOOGLE_PROFILE);
  facebookVerifier.verify.mockResolvedValue({
    providerUserId: 'fb-456',
    email: GOOGLE_PROFILE.email,
    fullName: 'Soc Ial',
  });
});

afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/google', () => {
  it('creates the account and signs in a first-time Google user', async () => {
    const res = await postGoogle();

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(GOOGLE_PROFILE.email);

    const row = await prisma.registration.findFirst();
    expect(row.provider).toBe('GOOGLE');
    expect(row.providerUserId).toBe(GOOGLE_PROFILE.providerUserId);
    expect(row.passwordHash).toBeNull();
    expect(row.role).toBe('CLIENT');

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authIdentity.count()).toBe(1);
  });

  it('signs the same Google user back in without a second account', async () => {
    await postGoogle().expect(200);
    const second = await postGoogle();

    expect(second.status).toBe(200);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.registration.count()).toBe(1);
  });

  it('signs in once an identity is linked', async () => {
    const user = await createUser({ email: GOOGLE_PROFILE.email, password: null });
    await prisma.authIdentity.create({
      data: {
        userId: user.id,
        provider: 'GOOGLE',
        providerUserId: GOOGLE_PROFILE.providerUserId,
        email: GOOGLE_PROFILE.email,
      },
    });

    const res = await postGoogle();

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });

  it('links Google to an existing account that shares the email', async () => {
    const user = await createUser({ email: GOOGLE_PROFILE.email });

    const res = await postGoogle();

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);

    const identity = await prisma.authIdentity.findFirst();
    expect(identity.userId).toBe(user.id);
    expect(identity.provider).toBe('GOOGLE');
    expect(await prisma.registration.count()).toBe(0);
  });

  it('surfaces an invalid provider token as 401', async () => {
    googleVerifier.verify.mockRejectedValue(
      AppError.unauthorized('INVALID_PROVIDER_TOKEN', 'Google token is invalid'),
    );

    const res = await postGoogle();

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_PROVIDER_TOKEN');
  });

  it('returns 503 when the provider is not configured', async () => {
    googleVerifier.verify.mockRejectedValue(
      new AppError('PROVIDER_NOT_CONFIGURED', 503, 'Google sign-in is not configured'),
    );

    const res = await postGoogle();

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
});

describe('POST /api/v1/auth/facebook', () => {
  it('creates the account and signs in a first-time Facebook user', async () => {
    const res = await postFacebook();

    expect(res.status).toBe(200);
    expect((await prisma.registration.findFirst()).provider).toBe('FACEBOOK');
    expect(await prisma.user.count()).toBe(1);
  });

  it('lets one account carry both Google and Facebook', async () => {
    const user = await createUser({ email: GOOGLE_PROFILE.email });

    await postGoogle().expect(200);
    await postFacebook().expect(200);

    const identities = await prisma.authIdentity.findMany({ where: { userId: user.id } });
    expect(identities.map((i) => i.provider).sort()).toEqual(['FACEBOOK', 'GOOGLE']);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('linking a social identity by email', () => {
  it.each([
    ['Google', 'INSTRUCTOR', () => postGoogle()],
    ['Google', 'ADMIN', () => postGoogle()],
    ['Facebook', 'INSTRUCTOR', () => postFacebook()],
    ['Facebook', 'ADMIN', () => postFacebook()],
  ])('refuses %s onto an existing %s account', async (_provider, role, post) => {
    const user = await createUser({ email: GOOGLE_PROFILE.email, role });

    const res = await post();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('IDENTITY_LINK_NOT_ALLOWED');
    expect(res.body.data).toBeUndefined();
    expect(await prisma.authIdentity.count({ where: { userId: user.id } })).toBe(0);
  });

  it('still signs in an INSTRUCTOR account through an identity that is already linked', async () => {
    const user = await createUser({ email: GOOGLE_PROFILE.email, role: 'INSTRUCTOR' });
    await prisma.authIdentity.create({
      data: { userId: user.id, provider: 'GOOGLE', providerUserId: GOOGLE_PROFILE.providerUserId },
    });

    const res = await postGoogle();

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(user.id);
  });
});

