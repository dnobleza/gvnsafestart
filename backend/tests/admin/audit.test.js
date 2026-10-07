const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeAdmin, makeInstructor, makeBranch, ADDRESS, makeClient, makeBooking, auth } = require('./factories');

const FUTURE = '2999-06-01T02:00:00.000Z';

const rows = (action) => prisma.auditLog.findMany({ where: { action } });

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('audit trail', () => {
  it('writes exactly one INSTRUCTOR_CREATED row with no secrets', async () => {
    const admin = await makeAdmin();
    const branch = await makeBranch({ name: 'Makati' });

    const res = await request(app)
      .post('/api/v1/admin/instructors')
      .set(auth(admin))
      .set('User-Agent', 'jest-agent')
      .send({ fullName: 'Sam Instructor', email: 'sam@test.local', address: ADDRESS, branchId: branch.id });

    const logs = await rows('INSTRUCTOR_CREATED');
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: admin.id,
      actorEmail: admin.email,
      targetType: 'USER',
      targetId: res.body.data.instructor.id,
      userAgent: 'jest-agent',
    });
    expect(logs[0].ip).toBeTruthy();
    const serialised = JSON.stringify(logs[0]);
    expect(serialised).not.toContain(res.body.data.temporaryPassword);
    expect(serialised).not.toMatch(/password|hash|\$2[aby]\$/i);
  });

  it('writes one row each for deactivate and reset-password with no secrets', async () => {
    const admin = await makeAdmin();
    const a = await makeInstructor();
    const b = await makeInstructor();

    const reset = await request(app).post(`/api/v1/admin/instructors/${a.id}/reset-password`).set(auth(admin));
    await request(app).post(`/api/v1/admin/instructors/${b.id}/deactivate`).set(auth(admin)).expect(200);

    const resetLogs = await rows('INSTRUCTOR_PASSWORD_RESET');
    const deactivateLogs = await rows('INSTRUCTOR_DEACTIVATED');
    expect(resetLogs).toHaveLength(1);
    expect(resetLogs[0].targetId).toBe(a.id);
    expect(deactivateLogs).toHaveLength(1);
    expect(deactivateLogs[0].targetId).toBe(b.id);
    const serialised = JSON.stringify([...resetLogs, ...deactivateLogs].map((l) => l.metadata));
    expect(serialised).not.toContain(reset.body.data.temporaryPassword);
    expect(serialised).not.toMatch(/password|hash|\$2[aby]\$/i);
  });

  it('writes one row per booking action with before and after values', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    const approved = await makeBooking(client);
    const moved = await makeBooking(client);
    const cancelled = await makeBooking(client);
    const post = (id, action, body) =>
      request(app).post(`/api/v1/admin/bookings/${id}/${action}`).set(auth(admin)).send(body);

    await post(approved.id, 'approve').expect(200);
    await post(moved.id, 'reschedule', { scheduledAt: FUTURE, reason: 'Moved' }).expect(200);
    await post(cancelled.id, 'cancel', { reason: 'No show' }).expect(200);

    expect((await rows('BOOKING_CONFIRMED'))[0]).toMatchObject({
      targetType: 'BOOKING',
      targetId: approved.id,
      metadata: { from: 'PENDING', to: 'CONFIRMED' },
    });
    expect((await rows('BOOKING_RESCHEDULED'))[0]).toMatchObject({
      targetId: moved.id,
      metadata: { from: moved.scheduledAt.toISOString(), to: FUTURE },
    });
    expect((await rows('BOOKING_CANCELLED'))[0]).toMatchObject({
      targetId: cancelled.id,
      metadata: { from: 'PENDING', to: 'CANCELLED', reason: 'No show' },
    });
    expect(await prisma.auditLog.count()).toBe(3);
  });

  it('keeps the actor email after the actor is deleted', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin();
    await request(app).post(`/api/v1/admin/admins/${other.id}/deactivate`).set(auth(admin)).expect(200);

    await prisma.user.delete({ where: { id: admin.id } });

    const log = (await rows('ADMIN_DEACTIVATED'))[0];
    expect(log.actorId).toBeNull();
    expect(log.actorEmail).toBe(admin.email);
  });
});

describe('GET /api/v1/admin/audit-logs', () => {
  it('lists newest first in the contract shape with pagination meta', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    const branch = await makeBranch({ name: 'Makati' });
    const booking = await makeBooking(client);
    await request(app).post(`/api/v1/admin/bookings/${booking.id}/approve`).set(auth(admin));
    await request(app)
      .post('/api/v1/admin/instructors')
      .set(auth(admin))
      .send({ fullName: 'Sam Instructor', email: 'sam@test.local', address: ADDRESS, branchId: branch.id });

    const res = await request(app).get('/api/v1/admin/audit-logs').set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    expect(res.body.data.map((l) => l.action)).toEqual(['INSTRUCTOR_CREATED', 'BOOKING_CONFIRMED']);
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      action: 'INSTRUCTOR_CREATED',
      targetType: 'USER',
      targetId: expect.any(String),
      metadata: {
        email: 'sam@test.local',
        fullName: 'Sam Instructor',
        branch: { id: branch.id, name: 'Makati' },
        address: ADDRESS,
      },
      actorEmail: admin.email,
      actor: { id: admin.id, fullName: admin.fullName },
      ip: expect.any(String),
      createdAt: expect.any(String),
    });
  });

  it('filters by action and by actor, and paginates', async () => {
    const first = await makeAdmin();
    const second = await makeAdmin();
    const client = await makeClient();
    for (let i = 0; i < 3; i += 1) {
      const booking = await makeBooking(client);
      await request(app).post(`/api/v1/admin/bookings/${booking.id}/approve`).set(auth(first));
    }
    const other = await makeBooking(client);
    await request(app)
      .post(`/api/v1/admin/bookings/${other.id}/cancel`)
      .set(auth(second))
      .send({ reason: 'Client asked' });

    const get = (qs) => request(app).get(`/api/v1/admin/audit-logs?${qs}`).set(auth(first));

    expect((await get('action=BOOKING_CANCELLED')).body.meta.total).toBe(1);
    expect((await get(`actorId=${first.id}`)).body.meta.total).toBe(3);
    const page = await get('page=2&limit=3');
    expect(page.body.meta).toEqual({ page: 2, limit: 3, total: 4 });
    expect(page.body.data).toHaveLength(1);
  });

  it('rejects a malformed actorId', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-logs?actorId=nope')
      .set(auth(await makeAdmin()));

    expect(res.status).toBe(400);
  });
});
