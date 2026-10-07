const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const {
  makeAdmin,
  makeInstructor,
  makeClient,
  makeBooking,
  makeBranch,
  makeAvailability,
  auth,
} = require('../admin/factories');
const { dayAhead, at } = require('../instructor/time');

const DAY = 86400000;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const api = (path) => `/api/v1/client${path}`;

const completed = (client, instructor, daysAgo = 1) =>
  makeBooking(client, {
    instructorId: instructor.id,
    status: 'COMPLETED',
    scheduledAt: new Date(Date.now() - daysAgo * DAY),
  });

const rate = (user, bookingId, body) => request(app).post(api(`/bookings/${bookingId}/rating`)).set(auth(user)).send(body);

describe('client booking flow', () => {
  it('is for clients only', async () => {
    const instructor = await makeInstructor();
    expect((await request(app).get(api('/bookings')).set(auth(instructor))).status).toBe(403);
  });

  it('books an available slot, records history, and notifies the instructor', async () => {
    const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
    const client = await makeClient({ fullName: 'Ana Reyes' });
    await makeAvailability(instructor);
    const day = dayAhead(8);

    const slots = await request(app).get(`/api/v1/instructors/${instructor.id}/slots?date=${day}&duration=90`);
    expect(slots.body.data.slots[0].time).toBe('08:00');
    expect(slots.body.data.slots.at(-1).time).toBe('15:30');

    const res = await request(app)
      .post(api('/bookings'))
      .set(auth(client))
      .send({ instructorId: instructor.id, scheduledAt: slots.body.data.slots[0].start, durationMinutes: 90, lessonType: 'Basic Driving', paymentMethod: 'CASH' });

    expect(res.status).toBe(201);
    expect(res.body.data.booking).toMatchObject({ status: 'PENDING', instructor: { id: instructor.id }, canRate: false });
    const id = res.body.data.booking.id;
    expect(await prisma.bookingHistory.count({ where: { bookingId: id, action: 'CREATED', changedByRole: 'CLIENT' } })).toBe(1);
    const note = await prisma.notification.findFirst({ where: { userId: instructor.id } });
    expect(note).toMatchObject({ type: 'BOOKING_CREATED', bookingId: id });
    expect(note.message).toContain('Ana Reyes');

    const clash = await request(app)
      .post(api('/bookings'))
      .set(auth(client))
      .send({ instructorId: instructor.id, scheduledAt: at(day, '09:00'), durationMinutes: 60, lessonType: 'Basic Driving', paymentMethod: 'CASH' });
    expect(clash.status).toBe(409);

    const outside = await request(app)
      .post(api('/bookings'))
      .set(auth(client))
      .send({ instructorId: instructor.id, scheduledAt: at(day, '18:00'), durationMinutes: 60, lessonType: 'Basic Driving', paymentMethod: 'CASH' });
    expect(outside.body.error.code).toBe('OUTSIDE_AVAILABILITY');
  });

  it('shows the latest reschedule reason and hides other clients\' bookings', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    const stranger = await makeClient();
    await makeAvailability(instructor);
    const booking = await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(5), '10:00') });
    await request(app)
      .patch(`/api/v1/instructor/bookings/${booking.id}/reschedule`)
      .set(auth(instructor))
      .send({ scheduledAt: at(dayAhead(6), '10:00'), reason: 'Car service' })
      .expect(200);

    const res = await request(app).get(api(`/bookings/${booking.id}`)).set(auth(client));
    expect(res.body.data.booking.statusNote).toMatchObject({ action: 'RESCHEDULED', reason: 'Car service', actorRole: 'INSTRUCTOR' });

    expect((await request(app).get(api(`/bookings/${booking.id}`)).set(auth(stranger))).status).toBe(404);
  });

  it('lets the client cancel with a reason and notifies the instructor', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    const booking = await makeBooking(client, { instructorId: instructor.id });

    expect((await request(app).patch(api(`/bookings/${booking.id}/cancel`)).set(auth(client)).send({})).status).toBe(400);
    const res = await request(app).patch(api(`/bookings/${booking.id}/cancel`)).set(auth(client)).send({ reason: 'Exam moved' });

    expect(res.body.data.booking.status).toBe('CANCELLED');
    const note = await prisma.notification.findFirst({ where: { userId: instructor.id } });
    expect(note.message).toContain('cancelled by the client');
    expect(await prisma.notification.count({ where: { userId: client.id } })).toBe(0);
  });
});

describe('ratings', () => {
  it('lets only the booking client rate a completed session, once, within 14 days', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    const other = await makeClient();
    const done = await completed(client, instructor);
    const pending = await makeBooking(client, { instructorId: instructor.id });
    const old = await completed(client, instructor, 15);

    expect((await rate(other, done.id, { stars: 5 })).status).toBe(404);
    expect((await rate(client, pending.id, { stars: 5 })).body.error.code).toBe('RATING_NOT_ALLOWED');
    expect((await rate(client, old.id, { stars: 5 })).body.error.code).toBe('RATING_WINDOW_CLOSED');
    for (const stars of [0, 6, 4.5, '5']) {
      expect((await rate(client, done.id, { stars })).status).toBe(400);
    }
    expect((await rate(client, done.id, { stars: 5, comment: 'x'.repeat(501) })).status).toBe(400);

    const ok = await rate(client, done.id, { stars: 4, comment: 'Patient and clear' });
    expect(ok.status).toBe(201);
    expect((await rate(client, done.id, { stars: 5 })).status).toBe(409);
    expect(await prisma.notification.count({ where: { userId: instructor.id, type: 'RATING_RECEIVED' } })).toBe(1);

    const detail = await request(app).get(api(`/bookings/${done.id}`)).set(auth(client));
    expect(detail.body.data.booking).toMatchObject({ rated: true, canRate: false });
  });

  it('shows "New" under 3 ratings, counts hidden ratings, and never reveals client names to instructors', async () => {
    const branch = await makeBranch({ name: 'Makati' });
    const instructor = await makeInstructor({ branch, fullName: 'Juan Dela Cruz' });
    const admin = await makeAdmin();
    const client = await makeClient({ fullName: 'Ana Reyes' });
    await makeAvailability(instructor);

    const picker = async () =>
      (await request(app).get('/api/v1/instructors')).body.data.find((i) => i.id === instructor.id);

    const bookings = [];
    for (let i = 0; i < 3; i += 1) bookings.push(await completed(client, instructor));
    await rate(client, bookings[0].id, { stars: 5 }).expect(201);
    await rate(client, bookings[1].id, { stars: 4, comment: 'Rude remark here' }).expect(201);
    expect((await picker()).rating).toMatchObject({ display: 'New', count: 2, average: null });

    await rate(client, bookings[2].id, { stars: 3 }).expect(201);
    expect((await picker()).rating).toMatchObject({ display: '4.0', count: 3, average: 4 });

    const adminList = await request(app).get('/api/v1/admin/ratings').set(auth(admin));
    const rude = adminList.body.data.ratings.find((r) => r.comment === 'Rude remark here');
    expect(rude.client).toEqual({ id: client.id, fullName: 'Ana Reyes' });
    expect(adminList.body.data.instructors[0]).toMatchObject({ fullName: 'Juan Dela Cruz', average: 4, count: 3 });

    await request(app).patch(`/api/v1/admin/ratings/${rude.id}/hide`).set(auth(admin)).send({ hidden: true }).expect(200);
    expect(await prisma.auditLog.count({ where: { action: 'RATING_HIDDEN', targetId: rude.id } })).toBe(1);

    const mine = await request(app).get('/api/v1/instructor/ratings').set(auth(instructor));
    expect(mine.body.data.summary).toMatchObject({
      average: 4,
      count: 3,
      breakdown: [
        { stars: 5, count: 1 },
        { stars: 4, count: 1 },
        { stars: 3, count: 1 },
        { stars: 2, count: 0 },
        { stars: 1, count: 0 },
      ],
    });
    expect(JSON.stringify(mine.body)).not.toContain('Ana Reyes');
    expect(JSON.stringify(mine.body)).not.toContain('Rude remark');
    expect(mine.body.data.ratings.map((r) => r.id)).not.toContain(rude.id);
    expect(mine.body.meta.total).toBe(2);

    await request(app).patch(`/api/v1/admin/ratings/${rude.id}/hide`).set(auth(admin)).send({ hidden: false }).expect(200);
    expect(await prisma.auditLog.count({ where: { action: 'RATING_UNHIDDEN' } })).toBe(1);

    const otherBranch = await makeBranch();
    const filtered = await request(app).get(`/api/v1/admin/ratings?branchId=${otherBranch.id}`).set(auth(admin));
    expect(filtered.body.meta.total).toBe(0);
  });
});

describe('admin booking timeline', () => {
  it('shows last action with actor and the full history with names and roles', async () => {
    const admin = await makeAdmin({ fullName: 'Ada Admin' });
    const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
    const client = await makeClient();
    await makeAvailability(instructor);
    const booking = await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(4), '10:00') });

    await request(app).patch(`/api/v1/instructor/bookings/${booking.id}/confirm`).set(auth(instructor)).expect(200);
    await request(app)
      .post(`/api/v1/admin/bookings/${booking.id}/reschedule`)
      .set(auth(admin))
      .send({ scheduledAt: at(dayAhead(5), '11:00'), reason: 'Branch closed' })
      .expect(200);

    const list = await request(app).get('/api/v1/admin/bookings').set(auth(admin));
    expect(list.body.data[0].lastAction).toMatchObject({ action: 'RESCHEDULED', actorName: 'Ada Admin', actorRole: 'ADMIN' });
    expect((await request(app).get('/api/v1/admin/bookings?actionBy=INSTRUCTOR').set(auth(admin))).body.meta.total).toBe(0);
    expect((await request(app).get('/api/v1/admin/bookings?actionBy=ADMIN').set(auth(admin))).body.meta.total).toBe(1);
    expect(
      (await request(app).get(`/api/v1/admin/bookings?instructorId=${instructor.id}`).set(auth(admin))).body.meta.total,
    ).toBe(1);

    const detail = await request(app).get(`/api/v1/admin/bookings/${booking.id}`).set(auth(admin));
    expect(detail.body.data.booking).toMatchObject({ id: booking.id, status: 'CONFIRMED', instructor: { id: instructor.id } });
    expect((await request(app).get('/api/v1/admin/bookings/00000000-0000-4000-8000-000000000000').set(auth(admin))).status).toBe(404);

    const history = await request(app).get(`/api/v1/admin/bookings/${booking.id}/history`).set(auth(admin));
    expect(history.body.data.history).toEqual([
      expect.objectContaining({ action: 'CONFIRMED', actorRole: 'INSTRUCTOR', actor: { id: instructor.id, fullName: 'Juan Dela Cruz' } }),
      expect.objectContaining({ action: 'RESCHEDULED', actorRole: 'ADMIN', reason: 'Branch closed', oldScheduledAt: expect.any(String) }),
    ]);

    const notes = await prisma.notification.findMany();
    expect(notes).toHaveLength(3);
    expect(notes.map((n) => [n.userId, n.type])).toEqual(expect.arrayContaining([
      [client.id, 'BOOKING_CONFIRMED'],
      [client.id, 'BOOKING_RESCHEDULED'],
      [instructor.id, 'BOOKING_RESCHEDULED'],
    ]));
  });
});
