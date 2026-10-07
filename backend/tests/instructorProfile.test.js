const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDb } = require('./helpers');
const { makeAdmin, makeInstructor, makeBranch, ADDRESS, makeClient, auth } = require('./admin/factories');

const url = '/api/v1/instructor/profile';

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/instructor/profile', () => {
  it('returns the caller own name, email, branch and address, uncached', async () => {
    const branch = await makeBranch({ name: 'Quezon City' });
    const me = await makeInstructor({ branch });
    await makeInstructor();

    const res = await request(app).get(url).set(auth(me));

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/no-store/);
    expect(res.body).toEqual({
      success: true,
      data: {
        profile: {
          id: me.id,
          fullName: me.fullName,
          email: me.email,
          branch: { id: branch.id, name: 'Quezon City' },
          address: ADDRESS,
        },
      },
    });
  });

  it('returns null branch and address when no profile exists yet', async () => {
    const me = await makeInstructor({ withProfile: false });

    const res = await request(app).get(url).set(auth(me));

    expect(res.status).toBe(200);
    expect(res.body.data.profile).toMatchObject({ branch: null, address: null });
  });

  it('shows an instructor only their own record, even with other instructors present', async () => {
    const me = await makeInstructor({ address: { ...ADDRESS, street: 'My Own Street' } });
    await makeInstructor({ address: { ...ADDRESS, street: 'Someone Elses Street' } });

    const res = await request(app).get(url).set(auth(me));

    expect(JSON.stringify(res.body)).toContain('My Own Street');
    expect(JSON.stringify(res.body)).not.toContain('Someone Elses Street');
  });

  it('rejects anonymous callers, clients and admins', async () => {
    const anon = await request(app).get(url);
    const client = await request(app).get(url).set(auth(await makeClient()));
    const admin = await request(app).get(url).set(auth(await makeAdmin()));

    expect(anon.status).toBe(401);
    expect(client.status).toBe(403);
    expect(client.body.error.code).toBe('FORBIDDEN');
    expect(admin.status).toBe(403);
  });

  it('rejects an inactive instructor', async () => {
    const me = await makeInstructor({ isActive: false });

    const res = await request(app).get(url).set(auth(me));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });
});
