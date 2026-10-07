const request = require('supertest');
const app = require('../../src/app');
const instructorService = require('../../src/services/instructor.service');
const { prisma, resetDb, refreshCookie } = require('../helpers');
const { makeAdmin, makeInstructor, makeBranch, ADDRESS, makeClient, auth } = require('./factories');

const ID = '00000000-0000-4000-8000-000000000000';
const base = '/api/v1/admin/instructors';

const body = (branch, overrides = {}) => ({
  fullName: 'Sam Instructor',
  email: 'sam@test.local',
  address: ADDRESS,
  branchId: branch.id,
  ...overrides,
});

const createInstructor = (admin, payload) => request(app).post(base).set(auth(admin)).send(payload);

const login = (email, password) => request(app).post('/api/v1/auth/login').send({ email, password });

const rows = (action) => prisma.auditLog.findMany({ where: { action } });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/admin/instructors', () => {
  it('creates the account, returns the detail shape with address and a one-time temporary password', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });

    const res = await createInstructor(admin, body(branch));

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const { instructor, temporaryPassword } = res.body.data;
    expect(instructor).toEqual({
      id: expect.any(String),
      fullName: 'Sam Instructor',
      email: 'sam@test.local',
      isActive: true,
      mustChangePassword: true,
      createdAt: expect.any(String),
      branch: { id: branch.id, name: 'Makati' },
      address: ADDRESS,
    });
    expect(temporaryPassword).toHaveLength(16);
    expect(temporaryPassword).toMatch(/[a-z]/);
    expect(temporaryPassword).toMatch(/[A-Z]/);
    expect(temporaryPassword).toMatch(/\d/);
    expect(temporaryPassword).toMatch(/[^A-Za-z0-9]/);
  });

  it('stores only a bcrypt hash, forces the INSTRUCTOR role, and persists the profile', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();

    const res = await createInstructor(admin, body(branch));

    const row = await prisma.user.findUnique({
      where: { email: 'sam@test.local' },
      include: { instructorProfile: true },
    });
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain(res.body.data.temporaryPassword);
    expect(row.mustChangePassword).toBe(true);
    expect(row.role).toBe('INSTRUCTOR');
    expect(row.instructorProfile).toMatchObject({ branchId: branch.id, ...ADDRESS });
  });

  it('refuses a role field, unknown fields, and a missing address', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();

    const role = await createInstructor(admin, { ...body(branch), role: 'ADMIN' });
    const extra = await createInstructor(admin, { ...body(branch), isActive: false });
    const noAddress = await createInstructor(admin, { ...body(branch), address: undefined });

    expect(role.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(noAddress.status).toBe(400);
    expect(await prisma.user.count({ where: { email: 'sam@test.local' } })).toBe(0);
  });

  it('reports each invalid field by name', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();

    const res = await createInstructor(admin, {
      fullName: '',
      email: 'nope',
      address: { street: '', barangay: '', city: '', province: '' },
      branchId: 'not-a-uuid',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d) => d.field).sort()).toEqual(
      ['address.barangay', 'address.city', 'address.province', 'address.street', 'branchId', 'email', 'fullName'],
    );
    expect(branch.id).toBeTruthy();
  });

  it('rejects an unknown or inactive branch with a branchId detail', async () => {
    const admin = await makeAdmin();
    const inactive = await makeBranch({ isActive: false });

    const unknown = await createInstructor(admin, body({ id: ID }));
    const closed = await createInstructor(admin, body(inactive));

    for (const res of [unknown, closed]) {
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toEqual([{ field: 'branchId', message: 'Choose an active branch' }]);
    }
    expect(await prisma.user.count()).toBe(1);
  });

  it('refuses a duplicate email held by a user or a signup record', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();
    await makeClient({ email: 'sam@test.local' });
    await prisma.registration.create({ data: { email: 'old@test.local', fullName: 'Old Signup' } });

    const user = await createInstructor(admin, body(branch));
    const signup = await createInstructor(admin, body(branch, { email: 'old@test.local' }));

    expect(user.status).toBe(409);
    expect(user.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
    expect(signup.status).toBe(409);
    expect(signup.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });

  it('lets the new account log in, but locks it to the password change until it is done', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();
    const { body: created } = await createInstructor(admin, body(branch));

    const session = await login('sam@test.local', created.data.temporaryPassword);

    expect(session.status).toBe(200);
    expect(session.body.data.user).toMatchObject({ role: 'INSTRUCTOR', mustChangePassword: true });
    const headers = { Authorization: `Bearer ${session.body.data.accessToken}` };

    const blocked = await request(app).get('/api/v1/instructor/profile').set(headers);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});

describe('GET /api/v1/admin/instructors', () => {
  it('lists only instructors with the row shape and never an address', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Pasig' });
    const instructor = await makeInstructor({ branch });
    await makeClient();

    const res = await request(app).get(base).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(res.body.data).toEqual([
      {
        id: instructor.id,
        fullName: instructor.fullName,
        email: instructor.email,
        isActive: true,
        mustChangePassword: false,
        createdAt: expect.any(String),
        branch: { id: branch.id, name: 'Pasig' },
      },
    ]);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('address');
    for (const value of Object.values(ADDRESS)) expect(raw).not.toContain(value);
  });

  it('returns a null branch for an instructor without a profile', async () => {
    const admin = await makeAdmin();
    await makeInstructor({ withProfile: false });

    const res = await request(app).get(base).set(auth(admin));

    expect(res.body.data[0].branch).toBeNull();
  });

  it('filters by status and branch, and paginates', async () => {
    const admin = await makeAdmin();
    const a = await makeBranch();
    const b = await makeBranch();
    await makeInstructor({ branch: a, isActive: false });
    await makeInstructor({ branch: a });
    await makeInstructor({ branch: b });

    const get = (q) => request(app).get(`${base}?${q}`).set(auth(admin));

    expect((await get('status=active')).body.meta.total).toBe(2);
    expect((await get('status=inactive')).body.meta.total).toBe(1);
    expect((await get('status=all')).body.meta.total).toBe(3);
    expect((await get(`branchId=${a.id}`)).body.meta.total).toBe(2);
    const page = await get('limit=1&page=2');
    expect(page.body.data).toHaveLength(1);
    expect(page.body.meta).toEqual({ page: 2, limit: 1, total: 3 });
  });

  it('rejects an unknown status, a bad branchId and an oversized limit', async () => {
    const admin = await makeAdmin();

    for (const q of ['status=gone', 'branchId=x', 'limit=101']) {
      const res = await request(app).get(`${base}?${q}`).set(auth(admin));
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /api/v1/admin/instructors/:id', () => {
  it('returns the detail shape with the address', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Taguig' });
    const instructor = await makeInstructor({ branch });

    const res = await request(app).get(`${base}/${instructor.id}`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.data.instructor).toMatchObject({
      id: instructor.id,
      branch: { id: branch.id, name: 'Taguig' },
      address: ADDRESS,
    });
  });

  it('returns a null address when there is no profile', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor({ withProfile: false });

    const res = await request(app).get(`${base}/${instructor.id}`).set(auth(admin));

    expect(res.body.data.instructor).toMatchObject({ branch: null, address: null });
  });

  it('returns 404 INSTRUCTOR_NOT_FOUND for a client, an admin and an unknown id', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();

    for (const id of [client.id, admin.id, ID]) {
      const res = await request(app).get(`${base}/${id}`).set(auth(admin));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSTRUCTOR_NOT_FOUND');
    }
  });

  it('rejects a malformed id', async () => {
    const res = await request(app).get(`${base}/nope`).set(auth(await makeAdmin()));

    expect(res.status).toBe(400);
  });
});

describe('address privacy and access', () => {
  it('gives a client and an instructor 403 on detail, patch and list, without leaking the address', async () => {
    const target = await makeInstructor();
    const other = await makeInstructor();
    const client = await makeClient();

    for (const caller of [client, other]) {
      const detail = await request(app).get(`${base}/${target.id}`).set(auth(caller));
      const patch = await request(app).patch(`${base}/${target.id}`).set(auth(caller)).send({ fullName: 'Hacked Name' });
      const list = await request(app).get(base).set(auth(caller));

      for (const res of [detail, patch, list]) {
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        expect(JSON.stringify(res.body)).not.toContain(ADDRESS.street);
      }
    }
    expect((await prisma.user.findUnique({ where: { id: target.id } })).fullName).toBe('Instructor User');
  });

  it('gives an instructor no way to reach or edit instructor data on their own routes', async () => {
    const me = await makeInstructor();
    const other = await makeInstructor();

    const byId = await request(app).get(`/api/v1/instructor/profile/${other.id}`).set(auth(me));
    const put = await request(app).put('/api/v1/instructor/profile').set(auth(me)).send({ fullName: 'X Y' });
    const patch = await request(app).patch('/api/v1/instructor/profile').set(auth(me)).send({ fullName: 'X Y' });
    const post = await request(app).post('/api/v1/instructor/profile').set(auth(me)).send({ fullName: 'X Y' });

    for (const res of [byId, put, patch, post]) expect(res.status).toBe(404);
    expect((await prisma.user.findUnique({ where: { id: me.id } })).fullName).toBe('Instructor User');
  });

  it('keeps address out of every list and action response except detail, create and patch', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();
    const instructor = await makeInstructor({ branch });

    const responses = [
      await request(app).get(base).set(auth(admin)),
      await request(app).get(`${base}?status=all&branchId=${branch.id}`).set(auth(admin)),
      await request(app).get('/api/v1/admin/branches').set(auth(admin)),
      await request(app).get('/api/v1/admin/branches/options').set(auth(admin)),
      await request(app).get('/api/v1/admin/admins').set(auth(admin)),
      await request(app).get('/api/v1/admin/audit-logs').set(auth(admin)),
      await request(app).post(`${base}/${instructor.id}/deactivate`).set(auth(admin)),
    ];

    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toContain(ADDRESS.street);
    }
  });
});

describe('PATCH /api/v1/admin/instructors/:id', () => {
  const patch = (admin, id, payload) => request(app).patch(`${base}/${id}`).set(auth(admin)).send(payload);

  it('updates name, address and branch and returns the detail shape', async () => {
    const admin = await makeAdmin();
    const next = await makeBranch({ name: 'Taguig' });
    const instructor = await makeInstructor();
    const address = { street: '9 New St', barangay: 'New Brgy', city: 'Taguig', province: 'Metro Manila' };

    const res = await patch(admin, instructor.id, { fullName: 'Renamed Person', address, branchId: next.id });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.data.instructor).toMatchObject({
      id: instructor.id,
      fullName: 'Renamed Person',
      email: instructor.email,
      branch: { id: next.id, name: 'Taguig' },
      address,
    });
  });

  it('rejects an empty body, email, role, isActive and partial address', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor();

    for (const payload of [
      {},
      { email: 'x@test.local' },
      { role: 'ADMIN' },
      { isActive: false },
      { address: { street: 'only' } },
    ]) {
      const res = await patch(admin, instructor.id, payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects moving to an inactive or unknown branch but allows staying on one', async () => {
    const admin = await makeAdmin();
    const closed = await makeBranch({ isActive: false });
    const instructor = await makeInstructor({ branch: closed });
    const other = await makeInstructor();

    const move = await patch(admin, other.id, { branchId: closed.id });
    const unknown = await patch(admin, other.id, { branchId: ID });
    const stay = await patch(admin, instructor.id, { branchId: closed.id, fullName: 'Still Here' });

    expect(move.status).toBe(400);
    expect(move.body.error.details).toEqual([{ field: 'branchId', message: 'Choose an active branch' }]);
    expect(unknown.status).toBe(400);
    expect(stay.status).toBe(200);
    expect(stay.body.data.instructor.branch.id).toBe(closed.id);
  });

  it('returns 404 INSTRUCTOR_NOT_FOUND for a client and an unknown id', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();

    for (const id of [client.id, ID]) {
      const res = await patch(admin, id, { fullName: 'Some Name' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSTRUCTOR_NOT_FOUND');
    }
  });

  it('completes a profile-less instructor only when address and branch are both sent', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();
    const instructor = await makeInstructor({ withProfile: false });

    const partial = await patch(admin, instructor.id, { branchId: branch.id });
    const full = await patch(admin, instructor.id, { branchId: branch.id, address: ADDRESS });

    expect(partial.status).toBe(400);
    expect(partial.body.error.details[0].field).toBe('address');
    expect(full.status).toBe(200);
    expect(full.body.data.instructor).toMatchObject({ branch: { id: branch.id }, address: ADDRESS });
  });

  it('cannot edit an admin account through this endpoint', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();

    const res = await patch(admin, other.id, { fullName: 'Taken Over' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/admin/instructors/:id/deactivate', () => {
  it('deactivates, blocks login, revokes live refresh tokens and returns the row shape', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor({ email: 'sam@test.local' });
    const session = await login('sam@test.local', 'Passw0rd!');
    const cookie = refreshCookie(session);

    const res = await request(app).post(`${base}/${instructor.id}/deactivate`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.instructor).toMatchObject({ id: instructor.id, isActive: false });
    expect(res.body.data.instructor).not.toHaveProperty('address');

    const relogin = await login('sam@test.local', 'Passw0rd!');
    expect(relogin.status).toBe(403);
    expect(relogin.body.error.code).toBe('ACCOUNT_INACTIVE');
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: instructor.id, revokedAt: null } })).toBe(0);
  });

  it('returns 404 INSTRUCTOR_NOT_FOUND for a client, an admin and an unknown id', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();
    const client = await makeClient();

    for (const id of [client.id, other.id, ID]) {
      const res = await request(app).post(`${base}/${id}/deactivate`).set(auth(admin));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('INSTRUCTOR_NOT_FOUND');
    }
    expect((await prisma.user.findUnique({ where: { id: other.id } })).isActive).toBe(true);
  });

  it('rejects a malformed id', async () => {
    const res = await request(app).post(`${base}/nope/deactivate`).set(auth(await makeAdmin()));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/admin/instructors/:id/reset-password', () => {
  it('issues a new temporary password, flags the account, and revokes sessions', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor({ email: 'sam@test.local' });
    const session = await login('sam@test.local', 'Passw0rd!');
    const cookie = refreshCookie(session);

    const res = await request(app).post(`${base}/${instructor.id}/reset-password`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    const { temporaryPassword } = res.body.data;
    expect(Object.keys(res.body.data)).toEqual(['temporaryPassword']);
    expect(temporaryPassword).toHaveLength(16);

    const row = await prisma.user.findUnique({ where: { id: instructor.id } });
    expect(row.mustChangePassword).toBe(true);
    expect(row.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(row.passwordHash).not.toContain(temporaryPassword);

    expect((await login('sam@test.local', 'Passw0rd!')).status).toBe(401);
    const fresh = await login('sam@test.local', temporaryPassword);
    expect(fresh.status).toBe(200);
    expect(fresh.body.data.user.mustChangePassword).toBe(true);
    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(refresh.status).toBe(401);
  });

  it('returns 404 INSTRUCTOR_NOT_FOUND for a client', async () => {
    const res = await request(app)
      .post(`${base}/${(await makeClient()).id}/reset-password`)
      .set(auth(await makeAdmin()));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INSTRUCTOR_NOT_FOUND');
  });
});

describe('instructor audit rows', () => {
  const patch = (admin, id, payload) => request(app).patch(`${base}/${id}`).set(auth(admin)).send(payload);

  it('INSTRUCTOR_CREATED carries email, name, branch and address but no secrets', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });

    const res = await createInstructor(admin, body(branch));

    const logs = await rows('INSTRUCTOR_CREATED');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: admin.id,
      targetType: 'USER',
      targetId: res.body.data.instructor.id,
      metadata: {
        email: 'sam@test.local',
        fullName: 'Sam Instructor',
        branch: { id: branch.id, name: 'Makati' },
        address: ADDRESS,
      },
    });
    expect(JSON.stringify(logs[0].metadata)).not.toContain(res.body.data.temporaryPassword);
    expect(JSON.stringify(logs[0].metadata)).not.toMatch(/password|hash|\$2[aby]\$/i);
  });

  it('INSTRUCTOR_UPDATED records only the changed fields', async () => {
    const admin = await makeAdmin();
    const from = await makeBranch({ name: 'Makati' });
    const to = await makeBranch({ name: 'Pasig' });
    const instructor = await makeInstructor({ branch: from });

    await patch(admin, instructor.id, { fullName: 'Instructor User', branchId: to.id }).expect(200);
    const second = { ...ADDRESS, city: 'Pasig' };
    await patch(admin, instructor.id, { fullName: 'New Name', address: second }).expect(200);

    const logs = (await rows('INSTRUCTOR_UPDATED')).sort((x, y) => x.createdAt - y.createdAt);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ targetId: instructor.id, targetType: 'USER' });
    expect(logs[0].metadata).toEqual({
      changes: { branch: { from: { id: from.id, name: 'Makati' }, to: { id: to.id, name: 'Pasig' } } },
    });
    expect(logs[1].metadata).toEqual({
      changes: {
        fullName: { from: 'Instructor User', to: 'New Name' },
        address: { from: ADDRESS, to: second },
      },
    });
  });

  it('writes no row and leaves the record alone when nothing changed', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();
    const instructor = await makeInstructor({ branch });
    const before = await prisma.user.findUnique({ where: { id: instructor.id } });

    const res = await patch(admin, instructor.id, {
      fullName: instructor.fullName,
      address: ADDRESS,
      branchId: branch.id,
    });

    expect(res.status).toBe(200);
    expect(await prisma.auditLog.count()).toBe(0);
    expect((await prisma.user.findUnique({ where: { id: instructor.id } })).updatedAt).toEqual(before.updatedAt);
  });

  it('writes no row for a rejected update', async () => {
    const admin = await makeAdmin();
    const closed = await makeBranch({ isActive: false });
    const instructor = await makeInstructor();

    await patch(admin, instructor.id, { fullName: 'Changed Name', branchId: closed.id }).expect(400);

    expect(await prisma.auditLog.count()).toBe(0);
    expect((await prisma.user.findUnique({ where: { id: instructor.id } })).fullName).toBe('Instructor User');
  });

  it('writes one INSTRUCTOR_DEACTIVATED and one INSTRUCTOR_PASSWORD_RESET row with only the email', async () => {
    const admin = await makeAdmin();
    const a = await makeInstructor();
    const b = await makeInstructor();

    const reset = await request(app).post(`${base}/${a.id}/reset-password`).set(auth(admin));
    await request(app).post(`${base}/${b.id}/deactivate`).set(auth(admin)).expect(200);

    const resetLogs = await rows('INSTRUCTOR_PASSWORD_RESET');
    const deactivateLogs = await rows('INSTRUCTOR_DEACTIVATED');
    expect(resetLogs).toHaveLength(1);
    expect(resetLogs[0]).toMatchObject({ targetId: a.id, metadata: { email: a.email } });
    expect(deactivateLogs).toHaveLength(1);
    expect(deactivateLogs[0]).toMatchObject({ targetId: b.id, metadata: { email: b.email } });
    expect(JSON.stringify(resetLogs[0].metadata)).not.toContain(reset.body.data.temporaryPassword);
  });

  it('does not write a second deactivation row for an already inactive instructor', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor({ isActive: false });

    await request(app).post(`${base}/${instructor.id}/deactivate`).set(auth(admin)).expect(200);

    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('rolls the audit row back with a failed change', async () => {
    const admin = await makeAdmin();
    const instructor = await makeInstructor();

    await expect(
      instructorService.update(instructor.id, admin, { branchId: ID }, {}),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    expect(await prisma.auditLog.count()).toBe(0);
  });
});
