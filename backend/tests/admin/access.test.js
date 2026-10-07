const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeAdmin, makeInstructor, makeClient, auth } = require('./factories');

const ID = '00000000-0000-4000-8000-000000000000';

const ROUTES = [
  ['get', '/overview'],
  ['get', '/payments'],
  ['get', '/bookings'],
  ['post', `/bookings/${ID}/approve`],
  ['post', `/bookings/${ID}/reschedule`, { scheduledAt: '2999-01-01T00:00:00Z' }],
  ['post', `/bookings/${ID}/cancel`, {}],
  ['get', '/instructors'],
  ['get', `/instructors/${ID}`],
  ['post', '/instructors', { fullName: 'New Person', email: 'new.person@test.local', branchId: ID, address: { street: 'a', barangay: 'b', city: 'c', province: 'd' } }],
  ['patch', `/instructors/${ID}`, { fullName: 'Renamed Person' }],
  ['post', `/instructors/${ID}/deactivate`],
  ['post', `/instructors/${ID}/reset-password`],
  ['get', '/admins'],
  ['post', '/admins', { fullName: 'New Admin', email: 'new.admin@test.local' }],
  ['post', `/admins/${ID}/deactivate`],
  ['post', `/admins/${ID}/reset-password`],
  ['get', '/branches'],
  ['get', '/branches/options'],
  ['post', '/branches', { name: 'Access Branch' }],
  ['patch', `/branches/${ID}`, { name: 'Renamed Branch' }],
  ['get', '/audit-logs'],
];

const call = (method, path, body, headers = {}) => {
  const req = request(app)[method](`/api/v1/admin${path}`).set(headers);
  return body ? req.send(body) : req;
};

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe.each(ROUTES)('%s /api/v1/admin%s', (method, path, body) => {
  it('rejects an anonymous caller with 401', async () => {
    const res = await call(method, path, body);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rejects a CLIENT with 403 FORBIDDEN', async () => {
    const res = await call(method, path, body, auth(await makeClient()));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an INSTRUCTOR with 403 FORBIDDEN', async () => {
    const res = await call(method, path, body, auth(await makeInstructor()));

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an ADMIN through', async () => {
    const res = await call(method, path, body, auth(await makeAdmin()));

    expect([401, 403]).not.toContain(res.status);
    if (method === 'get' && !path.includes(ID)) expect(res.status).toBe(200);
  });
});
