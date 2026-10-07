const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeInstructor, makeClient, makeBooking, makeAvailability, auth } = require('../admin/factories');
const { dayAhead, at } = require('./time');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const api = (path) => `/api/v1/instructor${path}`;

describe('availability', () => {
  it('replaces weekly hours and audits the change', async () => {
    const instructor = await makeInstructor();
    await makeAvailability(instructor, { days: [0] });
    const weekly = [
      { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '15:00' },
    ];

    const res = await request(app).put(api('/availability')).set(auth(instructor)).send({ weekly });

    expect(res.status).toBe(200);
    expect(res.body.data.weekly).toEqual(weekly);
    expect(await prisma.instructorAvailability.count()).toBe(3);
    expect(await prisma.auditLog.count({ where: { action: 'AVAILABILITY_UPDATED' } })).toBe(1);
  });

  it('rejects overlapping, inverted or malformed hours, and any instructorId', async () => {
    const instructor = await makeInstructor();
    const other = await makeInstructor();
    const put = (body) => request(app).put(api('/availability')).set(auth(instructor)).send(body);

    for (const body of [
      { weekly: [{ dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, { dayOfWeek: 1, startTime: '11:00', endTime: '13:00' }] },
      { weekly: [{ dayOfWeek: 1, startTime: '12:00', endTime: '08:00' }] },
      { weekly: [{ dayOfWeek: 7, startTime: '08:00', endTime: '12:00' }] },
      { weekly: [{ dayOfWeek: 1, startTime: '8am', endTime: '12:00' }] },
      { weekly: [], instructorId: other.id },
    ]) {
      expect((await put(body)).status).toBe(400);
    }
  });

  it('adds, lists and removes days off, scoped to me', async () => {
    const instructor = await makeInstructor();
    const other = await makeInstructor();
    const date = dayAhead(5);

    const created = await request(app).post(api('/days-off')).set(auth(instructor)).send({ date, reason: 'Family' });
    expect(created.status).toBe(201);
    expect(created.body.data.dayOff).toMatchObject({ date, reason: 'Family' });

    const dup = await request(app).post(api('/days-off')).set(auth(instructor)).send({ date });
    expect(dup.status).toBe(409);

    const listed = await request(app).get(api('/availability')).set(auth(instructor));
    expect(listed.body.data.daysOff).toHaveLength(1);

    const id = created.body.data.dayOff.id;
    expect((await request(app).delete(api(`/days-off/${id}`)).set(auth(other))).status).toBe(404);
    expect((await request(app).delete(api(`/days-off/${id}`)).set(auth(instructor))).status).toBe(200);
    expect(await prisma.instructorDayOff.count()).toBe(0);
  });

  it('lists only free slots inside working hours, skipping days off', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    await makeAvailability(instructor, { startTime: '08:00', endTime: '11:00' });
    const day = dayAhead(6);
    const mine = await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(day, '09:00') });

    const res = await request(app).get(api(`/availability/slots?date=${day}&duration=60`)).set(auth(instructor));
    expect(res.body.data.slots.map((s) => s.time)).toEqual(['08:00', '10:00']);

    const forOwn = await request(app)
      .get(api(`/availability/slots?date=${day}&bookingId=${mine.id}`))
      .set(auth(instructor));
    expect(forOwn.body.data.slots.map((s) => s.time)).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00']);

    await prisma.instructorDayOff.create({ data: { instructorId: instructor.id, date: new Date(`${day}T00:00:00Z`) } });
    const off = await request(app).get(api(`/availability/slots?date=${day}`)).set(auth(instructor));
    expect(off.body.data).toMatchObject({ dayOff: true, slots: [] });
  });
});

describe('schedule', () => {
  it('returns my sessions in the range, all statuses', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(2), '09:00') });
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(2), '11:00'), status: 'CANCELLED' });
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(9), '09:00') });
    await makeBooking(client, { scheduledAt: at(dayAhead(2), '09:00') });

    const res = await request(app)
      .get(api(`/schedule?from=${dayAhead(1)}&to=${dayAhead(7)}`))
      .set(auth(instructor));

    expect(res.status).toBe(200);
    expect(res.body.data.bookings.map((b) => b.status)).toEqual(['PENDING', 'CANCELLED']);
    expect((await request(app).get(api('/schedule')).set(auth(instructor))).status).toBe(400);
  });
});

describe('clients and notes', () => {
  it('lists only clients I have had sessions with, with history and private notes', async () => {
    const instructor = await makeInstructor();
    const other = await makeInstructor();
    const ana = await makeClient({ fullName: 'Ana Reyes' });
    const ben = await makeClient({ fullName: 'Ben Cruz' });
    await makeBooking(ana, { instructorId: instructor.id, scheduledAt: at(dayAhead(1), '09:00') });
    await makeBooking(ana, { instructorId: instructor.id, scheduledAt: at(dayAhead(2), '09:00') });
    await makeBooking(ben, { instructorId: other.id });

    const list = await request(app).get(api('/clients')).set(auth(instructor));
    expect(list.body.data).toEqual([
      { id: ana.id, fullName: 'Ana Reyes', phone: null, sessions: 2, lastSessionAt: expect.any(String) },
    ]);

    expect((await request(app).get(api(`/clients/${ben.id}`)).set(auth(instructor))).status).toBe(404);
    expect(
      (await request(app).post(api(`/clients/${ben.id}/notes`)).set(auth(instructor)).send({ note: 'x' })).status,
    ).toBe(404);

    const note = await request(app)
      .post(api(`/clients/${ana.id}/notes`))
      .set(auth(instructor))
      .send({ note: 'Nervous on highways' });
    expect(note.status).toBe(201);
    await prisma.clientNote.create({ data: { instructorId: other.id, clientId: ana.id, note: 'Not yours' } });

    const detail = await request(app).get(api(`/clients/${ana.id}`)).set(auth(instructor));
    expect(detail.body.data.sessions).toHaveLength(2);
    expect(detail.body.data.notes.map((n) => n.note)).toEqual(['Nervous on highways']);
  });
});

describe('notifications', () => {
  it('paginates newest first with an unread count, and marks read only my own', async () => {
    const instructor = await makeInstructor();
    const other = await makeInstructor();
    for (let i = 0; i < 3; i += 1) {
      await prisma.notification.create({
        data: { userId: instructor.id, type: 'T', title: `n${i}`, message: 'm', createdAt: new Date(Date.now() + i * 1000) },
      });
    }
    const theirs = await prisma.notification.create({ data: { userId: other.id, type: 'T', title: 'x', message: 'm' } });

    const page = await request(app).get(api('/notifications?limit=2')).set(auth(instructor));
    expect(page.body.data.map((n) => n.title)).toEqual(['n2', 'n1']);
    expect(page.body.meta).toEqual({ page: 1, limit: 2, total: 3, unread: 3 });

    expect((await request(app).patch(api(`/notifications/${theirs.id}/read`)).set(auth(instructor))).status).toBe(404);
    const first = page.body.data[0].id;
    await request(app).patch(api(`/notifications/${first}/read`)).set(auth(instructor)).expect(200);
    expect((await request(app).get(api('/notifications?unread=true')).set(auth(instructor))).body.meta.total).toBe(2);

    const all = await request(app).patch(api('/notifications/read-all')).set(auth(instructor));
    expect(all.body.data).toEqual({ updated: 2 });
    expect((await prisma.notification.findUnique({ where: { id: theirs.id } })).isRead).toBe(false);
  });
});
