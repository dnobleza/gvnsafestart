const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDb, createAdmin, createUser, bearer, refreshCookie } = require('./helpers');

const SIGNUP = {
  email: 'applicant@test.local',
  password: 'Passw0rd!',
  fullName: 'Ap Plicant',
  phone: '+639171234567',
};

const register = (body = SIGNUP) => request(app).post('/api/v1/auth/register').send(body);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/register', () => {
  it('returns a usable session straight away', async () => {
    const res = await register();

    expect(res.status).toBe(201);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user.email).toBe(SIGNUP.email);
    expect(refreshCookie(res)).toMatch(/^refresh_token=/);
  });

  it('writes one users row and one registrations row', async () => {
    await register().expect(201);

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.registration.count()).toBe(1);
  });

  it('stores the same password hash in both tables', async () => {
    await register().expect(201);

    const user = await prisma.user.findUnique({ where: { email: SIGNUP.email } });
    const registration = await prisma.registration.findUnique({ where: { email: SIGNUP.email } });

    expect(user.passwordHash).toBe(registration.passwordHash);
    expect(user.passwordHash.startsWith('$2')).toBe(true);
  });

  it('saves the full submitted detail on the registration row', async () => {
    await register().expect(201);

    const registration = await prisma.registration.findUnique({ where: { email: SIGNUP.email } });

    expect(registration.email).toBe(SIGNUP.email);
    expect(registration.phone).toBe(SIGNUP.phone);
    expect(registration.fullName).toBe(SIGNUP.fullName);
    expect(registration.role).toBe('CLIENT');
    expect(registration.provider).toBe('LOCAL');
    expect(registration.createdAt).toBeInstanceOf(Date);
  });

  it('keeps the two records unlinked', async () => {
    await register().expect(201);

    const registration = await prisma.registration.findFirst();

    // no FK and no user pointer of any spelling: the records are matched by
    // email or phone only
    expect(Object.keys(registration)).not.toContain('userId');
    expect(Object.keys(registration)).not.toContain('user_id');
  });

  it('lets the client log in immediately, with no approval step', async () => {
    await register().expect(201);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: SIGNUP.email, password: SIGNUP.password });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(SIGNUP.email);
  });

  it('refuses a role sent in the body', async () => {
    const res = await register({ ...SIGNUP, role: 'ADMIN' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.registration.count()).toBe(0);
  });

  it('rejects a weak password with a field-level validation error', async () => {
    const res = await register({ ...SIGNUP, password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'password' })]),
    );
    expect(await prisma.user.count()).toBe(0);
  });

  it('stores role CLIENT, which the applicant never chose', async () => {
    await register().expect(201);

    const user = await prisma.user.findFirst();
    expect(user.role).toBe('CLIENT');
  });

  it('rejects a duplicate email', async () => {
    await register().expect(201);

    const res = await register();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a duplicate phone', async () => {
    await register().expect(201);

    const res = await register({ ...SIGNUP, email: 'other@test.local' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('rejects an email that already belongs to an account', async () => {
    await createUser({ email: SIGNUP.email });

    const res = await register();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('writes neither row when the signup fails', async () => {
    await createUser({ email: SIGNUP.email });
    await register().expect(409);

    expect(await prisma.registration.count()).toBe(0);
    expect(await prisma.user.count()).toBe(1); // the pre-existing one only
  });
});

describe('GET /api/v1/registrations', () => {
  it('requires an admin', async () => {
    const client = await createUser();

    await request(app).get('/api/v1/registrations').expect(401);
    await request(app)
      .get('/api/v1/registrations')
      .set('Authorization', bearer(client))
      .expect(403);
  });

  it('returns the signup history with pagination meta', async () => {
    await register().expect(201);
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/v1/registrations?page=1&limit=10')
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe(SIGNUP.email);
    expect(res.body.data[0]).not.toHaveProperty('passwordHash');
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1 });
  });

  it('returns one registration by id', async () => {
    await register().expect(201);
    const admin = await createAdmin();
    const { id } = await prisma.registration.findFirst();

    const res = await request(app)
      .get(`/api/v1/registrations/${id}`)
      .set('Authorization', bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.registration.id).toBe(id);
  });

  it('no longer exposes approve or reject', async () => {
    await register().expect(201);
    const admin = await createAdmin();
    const { id } = await prisma.registration.findFirst();

    await request(app)
      .post(`/api/v1/registrations/${id}/approve`)
      .set('Authorization', bearer(admin))
      .send({ role: 'ADMIN' })
      .expect(404);

    await request(app)
      .post(`/api/v1/registrations/${id}/reject`)
      .set('Authorization', bearer(admin))
      .send({ reason: 'nope' })
      .expect(404);
  });
});
