const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeAdmin, makeInstructor, makeBranch, auth } = require('./factories');

const ID = '00000000-0000-4000-8000-000000000000';
const base = '/api/v1/admin/branches';

const rows = (action) => prisma.auditLog.findMany({ where: { action } });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/admin/branches', () => {
  it('creates a branch, trims the name and writes BRANCH_CREATED', async () => {
    const admin = await makeAdmin();

    const res = await request(app).post(base).set(auth(admin)).send({ name: '  Makati  ', latitude: 14.5547, longitude: 121.0244 });

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.data.branch).toEqual({
      id: expect.any(String),
      name: 'Makati',
      isActive: true,
      latitude: 14.5547,
      longitude: 121.0244,
      createdAt: expect.any(String),
      instructorCount: 0,
    });
    const logs = await rows('BRANCH_CREATED');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: admin.id,
      targetType: 'BRANCH',
      targetId: res.body.data.branch.id,
      metadata: { name: 'Makati' },
    });
  });

  it('rejects a duplicate name case-insensitively with 409 BRANCH_NAME_TAKEN and no audit row', async () => {
    const admin = await makeAdmin();
    await makeBranch({ name: 'Makati' });

    const res = await request(app).post(base).set(auth(admin)).send({ name: 'mAKATI', latitude: 14.5547, longitude: 121.0244 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BRANCH_NAME_TAKEN');
    expect(await prisma.branch.count()).toBe(1);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('rejects a blank name and unknown fields', async () => {
    const admin = await makeAdmin();

    for (const payload of [{ name: '   ' }, {}, { name: 'Ok', isActive: false }]) {
      const res = await request(app).post(base).set(auth(admin)).send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('GET /api/v1/admin/branches', () => {
  it('lists branches with instructorCount, status filter and meta', async () => {
    const admin = await makeAdmin();
    const a = await makeBranch({ name: 'A Branch' });
    await makeBranch({ name: 'B Branch', isActive: false });
    await makeInstructor({ branch: a });
    await makeInstructor({ branch: a });

    const all = await request(app).get(base).set(auth(admin));
    const active = await request(app).get(`${base}?status=active`).set(auth(admin));
    const inactive = await request(app).get(`${base}?status=inactive`).set(auth(admin));

    expect(all.status).toBe(200);
    expect(all.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(all.body.data[0]).toEqual({
      id: a.id,
      name: 'A Branch',
      isActive: true,
      latitude: null,
      longitude: null,
      createdAt: expect.any(String),
      instructorCount: 2,
    });
    expect(all.body.data[1].instructorCount).toBe(0);
    expect(active.body.meta.total).toBe(1);
    expect(inactive.body.data[0].name).toBe('B Branch');
  });

  it('rejects bad query values', async () => {
    const admin = await makeAdmin();

    expect((await request(app).get(`${base}?status=x`).set(auth(admin))).status).toBe(400);
    expect((await request(app).get(`${base}?limit=0`).set(auth(admin))).status).toBe(400);
  });
});

describe('GET /api/v1/admin/branches/options', () => {
  it('returns active branches only, in name order, unpaginated, as id and name', async () => {
    const admin = await makeAdmin();
    const b = await makeBranch({ name: 'Bravo' });
    const a = await makeBranch({ name: 'Alpha' });
    await makeBranch({ name: 'Closed', isActive: false });

    const res = await request(app).get(`${base}/options`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body.data).toEqual([
      { id: a.id, name: 'Alpha' },
      { id: b.id, name: 'Bravo' },
    ]);
    expect(res.body.meta).toBeUndefined();
  });
});

describe('PATCH /api/v1/admin/branches/:id', () => {
  const patch = (admin, id, payload) => request(app).patch(`${base}/${id}`).set(auth(admin)).send(payload);

  it('renames and deactivates, keeps assignments, and audits only the changed fields', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });
    const instructor = await makeInstructor({ branch });

    const rename = await patch(admin, branch.id, { name: 'Makati City', isActive: true });
    const off = await patch(admin, branch.id, { isActive: false });

    expect(rename.status).toBe(200);
    expect(rename.body.data.branch).toMatchObject({ name: 'Makati City', isActive: true, instructorCount: 1 });
    expect(off.body.data.branch).toMatchObject({ isActive: false, instructorCount: 1 });
    const profile = await prisma.instructorProfile.findUnique({ where: { userId: instructor.id } });
    expect(profile.branchId).toBe(branch.id);

    const logs = (await rows('BRANCH_UPDATED')).sort((x, y) => x.createdAt - y.createdAt);
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ targetType: 'BRANCH', targetId: branch.id });
    expect(logs[0].metadata).toEqual({ changes: { name: { from: 'Makati', to: 'Makati City' } } });
    expect(logs[1].metadata).toEqual({ changes: { isActive: { from: true, to: false } } });
  });

  it('allows a case-only rename of itself but not a name used by another branch', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });
    await makeBranch({ name: 'Pasig' });

    const same = await patch(admin, branch.id, { name: 'MAKATI' });
    const clash = await patch(admin, branch.id, { name: 'pasig' });

    expect(same.status).toBe(200);
    expect(same.body.data.branch.name).toBe('MAKATI');
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('BRANCH_NAME_TAKEN');
    expect((await prisma.branch.findUnique({ where: { id: branch.id } })).name).toBe('MAKATI');
  });

  it('writes no audit row when nothing changed', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });

    const res = await patch(admin, branch.id, { name: 'Makati', isActive: true });

    expect(res.status).toBe(200);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('returns 404 BRANCH_NOT_FOUND and rejects empty or unknown bodies', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch();

    const missing = await patch(admin, ID, { name: 'Anything' });
    const empty = await patch(admin, branch.id, {});
    const extra = await patch(admin, branch.id, { name: 'Ok', foo: 1 });
    const badId = await patch(admin, 'nope', { name: 'Ok' });

    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('BRANCH_NOT_FOUND');
    expect(empty.status).toBe(400);
    expect(extra.status).toBe(400);
    expect(badId.status).toBe(400);
  });
});
