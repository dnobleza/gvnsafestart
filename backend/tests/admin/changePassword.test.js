const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb, refreshCookie } = require('../helpers');
const { makeInstructor, makeClient } = require('./factories');

const TEMP = 'Temp0rary!Pass';
const NEXT = 'Brand-New1pass';

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });

const flaggedSession = async () => {
  const instructor = await makeInstructor({ email: 'sam@test.local', password: TEMP, mustChangePassword: true });
  const res = await login(instructor.email, TEMP);
  return { instructor, res, headers: { Authorization: `Bearer ${res.body.data.accessToken}` } };
};

const change = (headers, body) =>
  request(app).post('/api/v1/auth/change-password').set(headers).send(body);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('forced password change', () => {
  it('still lets a flagged user log in and reports the flag', async () => {
    const { res } = await flaggedSession();

    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(true);
  });

  it('blocks every other protected route until the password is changed', async () => {
    const { headers } = await flaggedSession();

    const res = await request(app).get('/api/v1/registrations').set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('does not flag ordinary users', async () => {
    await makeClient({ email: 'c@test.local' });

    const res = await login('c@test.local', 'Passw0rd!');

    expect(res.body.data.user.mustChangePassword).toBe(false);
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('clears the flag and returns a fresh session shaped like login', async () => {
    const { instructor, headers } = await flaggedSession();

    const res = await change(headers, { currentPassword: TEMP, newPassword: NEXT });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(res.body.data.user).toMatchObject({ id: instructor.id, mustChangePassword: false });
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(refreshCookie(res)).toBeTruthy();
    expect((await prisma.user.findUnique({ where: { id: instructor.id } })).mustChangePassword).toBe(false);

    const unlocked = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`);
    expect(unlocked.body.data.user.mustChangePassword).toBe(false);
  });

  it('switches the credential and revokes earlier refresh tokens', async () => {
    const { res: first, headers } = await flaggedSession();
    const oldCookie = refreshCookie(first);

    await change(headers, { currentPassword: TEMP, newPassword: NEXT }).expect(200);

    expect((await login('sam@test.local', TEMP)).status).toBe(401);
    expect((await login('sam@test.local', NEXT)).status).toBe(200);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', oldCookie);
    expect(refresh.status).toBe(401);
  });

  it('rejects a wrong current password with 401 INVALID_CREDENTIALS', async () => {
    const { headers } = await flaggedSession();

    const res = await change(headers, { currentPassword: 'Wrong-pass1', newPassword: NEXT });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects reusing the same password with a newPassword field error', async () => {
    const { headers } = await flaggedSession();

    const res = await change(headers, { currentPassword: TEMP, newPassword: TEMP });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'newPassword' })]),
    );
  });

  it('applies the signup password rules', async () => {
    const { headers } = await flaggedSession();

    const res = await change(headers, { currentPassword: TEMP, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'newPassword' })]),
    );
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: TEMP, newPassword: NEXT });

    expect(res.status).toBe(401);
  });

  it('works for an unflagged user too', async () => {
    await makeClient({ email: 'c@test.local' });
    const session = await login('c@test.local', 'Passw0rd!');

    const res = await change(
      { Authorization: `Bearer ${session.body.data.accessToken}` },
      { currentPassword: 'Passw0rd!', newPassword: NEXT },
    );

    expect(res.status).toBe(200);
  });

  it('writes a PASSWORD_CHANGED audit row with no secret in it', async () => {
    const { instructor, headers } = await flaggedSession();

    await change(headers, { currentPassword: TEMP, newPassword: NEXT }).expect(200);

    const rows = await prisma.auditLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'PASSWORD_CHANGED',
      actorId: instructor.id,
      actorEmail: instructor.email,
      targetType: 'USER',
      targetId: instructor.id,
    });
    expect(rows[0].metadata).toEqual({ email: instructor.email, wasTemporary: true });
    const raw = JSON.stringify(rows[0]);
    expect(raw).not.toContain(TEMP);
    expect(raw).not.toContain(NEXT);
    expect(raw).not.toMatch(/\$2[aby]\$/);
  });

  it('refuses a deactivated account and leaves its password alone', async () => {
    const { instructor, headers } = await flaggedSession();
    const before = (await prisma.user.findUnique({ where: { id: instructor.id } })).passwordHash;
    await prisma.user.update({ where: { id: instructor.id }, data: { isActive: false } });

    const res = await change(headers, { currentPassword: TEMP, newPassword: NEXT });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
    expect((await prisma.user.findUnique({ where: { id: instructor.id } })).passwordHash).toBe(before);
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
