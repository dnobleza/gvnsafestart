const request = require('supertest');
const app = require('../../src/app');
const adminService = require('../../src/services/admin.service');
const { prisma, resetDb, refreshCookie } = require('../helpers');
const { makeAdmin, makeInstructor, makeClient, auth } = require('./factories');

const ID = '00000000-0000-4000-8000-000000000000';
const base = '/api/v1/admin/admins';
const NEW_ADMIN = { fullName: 'Second Admin', email: 'second@test.local' };

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });
const rows = (action) => prisma.auditLog.findMany({ where: { action } });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/admin/admins', () => {
  it('creates an ADMIN with a one-time temporary password and a hash-only record', async () => {
    const admin = await makeAdmin();

    const res = await request(app).post(base).set(auth(admin)).send(NEW_ADMIN);

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const { admin: created, temporaryPassword } = res.body.data;
    expect(created).toEqual({
      id: expect.any(String),
      fullName: 'Second Admin',
      email: 'second@test.local',
      isActive: true,
      mustChangePassword: true,
      createdAt: expect.any(String),
    });
    expect(temporaryPassword).toHaveLength(16);

    const row = await prisma.user.findUnique({ where: { email: 'second@test.local' } });
    expect(row.role).toBe('ADMIN');
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain(temporaryPassword);
  });

  it('refuses a role field, unknown fields and a duplicate email', async () => {
    const admin = await makeAdmin();
    await makeClient({ email: 'second@test.local' });

    const role = await request(app).post(base).set(auth(admin)).send({ ...NEW_ADMIN, role: 'CLIENT' });
    const extra = await request(app).post(base).set(auth(admin)).send({ ...NEW_ADMIN, isActive: false });
    const dup = await request(app).post(base).set(auth(admin)).send(NEW_ADMIN);

    expect(role.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('writes one ADMIN_CREATED row with no secrets', async () => {
    const admin = await makeAdmin();

    const res = await request(app).post(base).set(auth(admin)).send(NEW_ADMIN);

    const logs = await rows('ADMIN_CREATED');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: admin.id,
      targetType: 'USER',
      targetId: res.body.data.admin.id,
      metadata: { email: 'second@test.local', fullName: 'Second Admin' },
    });
    expect(JSON.stringify(logs[0].metadata)).not.toContain(res.body.data.temporaryPassword);
    expect(JSON.stringify(logs[0].metadata)).not.toMatch(/password|hash|\$2[aby]\$/i);
  });
});

describe('GET /api/v1/admin/admins', () => {
  it('lists only admins with the row shape and meta', async () => {
    const admin = await makeAdmin();
    await makeInstructor();
    await makeClient();

    const res = await request(app).get(base).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(Object.keys(res.body.data[0]).sort()).toEqual(
      ['createdAt', 'email', 'fullName', 'id', 'isActive', 'mustChangePassword'],
    );
  });

  it('filters by status and rejects bad input', async () => {
    const admin = await makeAdmin();
    await makeAdmin({ isActive: false });

    const get = (q) => request(app).get(`${base}?${q}`).set(auth(admin));

    expect((await get('status=active')).body.meta.total).toBe(1);
    expect((await get('status=inactive')).body.meta.total).toBe(1);
    expect((await get('status=all')).body.meta.total).toBe(2);
    expect((await get('status=gone')).status).toBe(400);
    expect((await get('limit=101')).status).toBe(400);
  });
});

describe('POST /api/v1/admin/admins/:id/deactivate', () => {
  it('deactivates another admin, revokes sessions and writes ADMIN_DEACTIVATED', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin({ email: 'other@test.local' });
    const session = await login('other@test.local', 'Passw0rd!');
    const cookie = refreshCookie(session);

    const res = await request(app).post(`${base}/${other.id}/deactivate`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.admin).toMatchObject({ id: other.id, isActive: false });
    expect((await login('other@test.local', 'Passw0rd!')).status).toBe(403);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);
    const logs = await rows('ADMIN_DEACTIVATED');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ targetId: other.id, metadata: { email: 'other@test.local' } });
  });

  it('will not deactivate the caller', async () => {
    const admin = await makeAdmin();

    const res = await request(app).post(`${base}/${admin.id}/deactivate`).set(auth(admin));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_DEACTIVATE_SELF');
    expect((await prisma.user.findUnique({ where: { id: admin.id } })).isActive).toBe(true);
  });

  it('will not deactivate the last active admin', async () => {
    const lastAdmin = await makeAdmin();
    const staleActor = await makeAdmin({ isActive: false });

    await expect(adminService.deactivate(lastAdmin.id, staleActor, {})).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_ADMIN',
    });
    expect((await prisma.user.findUnique({ where: { id: lastAdmin.id } })).isActive).toBe(true);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('never leaves zero active admins when two admins deactivate each other at once', async () => {
    for (let round = 0; round < 5; round += 1) {
      await resetDb();
      const a = await makeAdmin();
      const b = await makeAdmin();

      const results = await Promise.allSettled([
        adminService.deactivate(b.id, a, {}),
        adminService.deactivate(a.id, b, {}),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({ code: 'LAST_ADMIN' });
      expect(await prisma.user.count({ where: { role: 'ADMIN', isActive: true } })).toBe(1);
      expect(await prisma.auditLog.count()).toBe(1);
    }
  });

  it('returns 404 ADMIN_NOT_FOUND for an instructor, a client and an unknown id', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor();
    const client = await makeClient();

    for (const id of [instructor.id, client.id, ID]) {
      const res = await request(app).post(`${base}/${id}/deactivate`).set(auth(admin));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ADMIN_NOT_FOUND');
    }
    expect((await prisma.user.findUnique({ where: { id: instructor.id } })).isActive).toBe(true);
  });

  it('rejects a malformed id', async () => {
    const res = await request(app).post(`${base}/nope/deactivate`).set(auth(await makeAdmin()));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/admin/admins/:id/reset-password', () => {
  it('issues a new temporary password, flags the account, revokes sessions and audits', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin({ email: 'other@test.local' });
    const session = await login('other@test.local', 'Passw0rd!');
    const cookie = refreshCookie(session);

    const res = await request(app).post(`${base}/${other.id}/reset-password`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const { temporaryPassword } = res.body.data;
    expect(Object.keys(res.body.data)).toEqual(['temporaryPassword']);

    const row = await prisma.user.findUnique({ where: { id: other.id } });
    expect(row.mustChangePassword).toBe(true);
    expect(row.passwordHash).not.toContain(temporaryPassword);
    expect((await login('other@test.local', 'Passw0rd!')).status).toBe(401);
    expect((await login('other@test.local', temporaryPassword)).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(401);

    const logs = await rows('ADMIN_PASSWORD_RESET');
    expect(logs).toHaveLength(1);
    expect(logs[0].metadata).toEqual({ email: 'other@test.local' });
  });

  it('returns 404 ADMIN_NOT_FOUND for an instructor', async () => {
    const res = await request(app)
      .post(`${base}/${(await makeInstructor()).id}/reset-password`)
      .set(auth(await makeAdmin()));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADMIN_NOT_FOUND');
  });
});
