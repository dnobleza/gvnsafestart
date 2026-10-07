const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDb, createUser, bearer, refreshCookie } = require('./helpers');

const CREDS = { email: 'user@test.local', password: 'Passw0rd!' };

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/login', () => {
  it('returns an access token and sets an httpOnly refresh cookie', async () => {
    await createUser();

    const res = await request(app).post('/api/v1/auth/login').send(CREDS);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(CREDS.email);
    expect(res.body.data).not.toHaveProperty('refreshToken');

    const cookie = (res.headers['set-cookie'] || []).find((c) => c.startsWith('refresh_token='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    await createUser();

    const wrong = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...CREDS, password: 'Wrongg1!' });
    const unknown = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.local', password: 'Passw0rd!' });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
  });

  it('rejects an invalid email format with a field-level validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: CREDS.password });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'email' })]),
    );
  });

  it('tells a social-only account to use its provider', async () => {
    await createUser({ password: null });

    const res = await request(app).post('/api/v1/auth/login').send(CREDS);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_LOGIN_UNAVAILABLE');
  });

  it('refuses a disabled account', async () => {
    await createUser({ isActive: false });

    const res = await request(app).post('/api/v1/auth/login').send(CREDS);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});

describe('refresh token rotation', () => {
  const login = async () => {
    await createUser();
    const res = await request(app).post('/api/v1/auth/login').send(CREDS);
    return refreshCookie(res);
  };

  it('rotates the token and issues a new cookie', async () => {
    const cookie = await login();

    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(refreshCookie(res)).not.toBe(cookie);
    expect(await prisma.refreshToken.count()).toBe(2);
  });

  it('revokes every session when a used token is replayed', async () => {
    const cookie = await login();
    await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);

    const replay = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    expect(await prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
  });

  it('rejects a refresh with no cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('logout revokes the token', async () => {
    const cookie = await login();

    await request(app).post('/api/v1/auth/logout').set('Cookie', cookie).expect(200);
    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);

    expect(after.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('requires a bearer token', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer nonsense');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_ACCESS_TOKEN');
  });

  it('returns the current user', async () => {
    const user = await createUser();

    const res = await request(app).get('/api/v1/auth/me').set('Authorization', bearer(user));

    expect(res.status).toBe(200);
    expect(res.body.data.user).toEqual({
      id: user.id,
      email: user.email,
      phone: user.phone,
      mustChangePassword: false,
      fullName: user.fullName,
      role: user.role,
    });
  });
});

describe('Cache-Control', () => {
  it('marks auth, admin and registration responses no-store', async () => {
    await createUser();
    const admin = await createUser({ email: 'admin@test.local', role: 'ADMIN' });

    const responses = await Promise.all([
      request(app).post('/api/v1/auth/login').send(CREDS),
      request(app).post('/api/v1/auth/login').send({ ...CREDS, password: 'wrong' }),
      request(app).get('/api/v1/admin/overview').set('Authorization', bearer(admin)),
      request(app).get('/api/v1/registrations').set('Authorization', bearer(admin)),
    ]);

    for (const res of responses) expect(res.headers['cache-control']).toBe('no-store');
  });
});

