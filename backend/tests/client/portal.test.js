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

const HOUR = 3600000;
const DAY = 24 * HOUR;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const api = (path) => `/api/v1/client${path}`;

const setup = async () => {
  const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
  const client = await makeClient({ fullName: 'Ana Reyes' });
  await makeAvailability(instructor);
  return { instructor, client };
};

describe('GET /client/dashboard', () => {
  it('returns the next session, unpaid, sessions to rate and unread count, only for me', async () => {
    const { instructor, client } = await setup();
    const other = await makeClient();
    const next = await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(2), '09:00') });
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(4), '09:00'), status: 'CONFIRMED', paymentStatus: 'PAID' });
    const toRate = await makeBooking(client, { instructorId: instructor.id, status: 'COMPLETED', scheduledAt: new Date(Date.now() - DAY) });
    await makeBooking(client, { instructorId: instructor.id, status: 'COMPLETED', scheduledAt: new Date(Date.now() - 20 * DAY) });
    await makeBooking(other, { instructorId: instructor.id, scheduledAt: at(dayAhead(1), '09:00') });
    await prisma.notification.create({ data: { userId: client.id, type: 'T', title: 't', message: 'm' } });

    const res = await request(app).get(api('/dashboard')).set(auth(client));

    expect(res.status).toBe(200);
    expect(res.body.data.nextSession).toMatchObject({ id: next.id, instructor: { fullName: 'Juan Dela Cruz' } });
    expect(res.body.data.counts).toEqual({ upcoming: 2, unpaid: 1, toRate: 1 });
    expect(res.body.data.toRate.map((b) => b.id)).toEqual([toRate.id]);
    expect(res.body.data.unreadNotifications).toBe(1);
  });
});

describe('GET /client/bookings tabs', () => {
  it('splits upcoming, past and cancelled and paginates', async () => {
    const { instructor, client } = await setup();
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(3), '09:00') });
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(2), '09:00') });
    await makeBooking(client, { instructorId: instructor.id, status: 'COMPLETED', scheduledAt: new Date(Date.now() - DAY) });
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: new Date(Date.now() - 2 * DAY) });
    await makeBooking(client, { instructorId: instructor.id, status: 'CANCELLED' });
    const tab = (qs) => request(app).get(api(`/bookings?${qs}`)).set(auth(client));

    const upcoming = await tab('tab=upcoming');
    expect(upcoming.body.meta.total).toBe(2);
    expect(new Date(upcoming.body.data[0].scheduledAt) < new Date(upcoming.body.data[1].scheduledAt)).toBe(true);
    expect((await tab('tab=past')).body.meta.total).toBe(2);
    expect((await tab('tab=cancelled')).body.meta.total).toBe(1);
    expect((await tab('tab=upcoming&limit=1&page=2')).body.data).toHaveLength(1);
    expect((await tab('tab=everything')).status).toBe(400);
  });
});

describe('GET /client/bookings/:id', () => {
  it('includes the full history with actor names, roles and reasons', async () => {
    const { instructor, client } = await setup();
    const res = await request(app)
      .post(api('/bookings'))
      .set(auth(client))
      .send({ instructorId: instructor.id, scheduledAt: at(dayAhead(5), '10:00'), durationMinutes: 60, lessonType: 'Basic Driving', paymentMethod: 'CASH' });
    const id = res.body.data.booking.id;
    await request(app).patch(`/api/v1/instructor/bookings/${id}/confirm`).set(auth(instructor)).expect(200);

    const detail = await request(app).get(api(`/bookings/${id}`)).set(auth(client));

    expect(detail.body.data.booking.history).toEqual([
      expect.objectContaining({ action: 'CREATED', actorRole: 'CLIENT', actor: { id: client.id, fullName: 'Ana Reyes' } }),
      expect.objectContaining({ action: 'CONFIRMED', actorRole: 'INSTRUCTOR', actor: { id: instructor.id, fullName: 'Juan Dela Cruz' } }),
    ]);
    expect(detail.body.data.booking).toMatchObject({ canCancel: true, canReschedule: true, changeCutoffHours: 24 });
  });
});

describe('client reschedule and cancel', () => {
  it('reschedules into an open slot with a reason and notifies the instructor', async () => {
    const { instructor, client } = await setup();
    const booking = await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(5), '10:00') });
    const move = (body) => request(app).patch(api(`/bookings/${booking.id}/reschedule`)).set(auth(client)).send(body);

    expect((await move({ scheduledAt: at(dayAhead(6), '10:00') })).status).toBe(400);
    expect((await move({ scheduledAt: at(dayAhead(6), '20:00'), reason: 'Work' })).body.error.code).toBe('OUTSIDE_AVAILABILITY');
    const ok = await move({ scheduledAt: at(dayAhead(6), '10:00'), reason: 'Work shift moved' });

    expect(ok.status).toBe(200);
    const h = await prisma.bookingHistory.findFirst({ where: { bookingId: booking.id, action: 'RESCHEDULED' } });
    expect(h).toMatchObject({ changedById: client.id, changedByRole: 'CLIENT', reason: 'Work shift moved' });
    const note = await prisma.notification.findFirst({ where: { userId: instructor.id } });
    expect(note.message).toContain('Work shift moved');
  });

  it('blocks changes inside the admin cutoff window, and respects a changed setting', async () => {
    const { instructor, client } = await setup();
    const admin = await makeAdmin();
    const soon = await makeBooking(client, { instructorId: instructor.id, scheduledAt: new Date(Date.now() + 10 * HOUR) });
    const cancel = () => request(app).patch(api(`/bookings/${soon.id}/cancel`)).set(auth(client)).send({ reason: 'Sick' });

    const blocked = await cancel();
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.code).toBe('CHANGE_WINDOW_CLOSED');
    const view = await request(app).get(api(`/bookings/${soon.id}`)).set(auth(client));
    expect(view.body.data.booking).toMatchObject({ canCancel: false, canReschedule: false });

    await request(app).patch('/api/v1/admin/settings').set(auth(admin)).send({ clientChangeCutoffHours: 6 }).expect(200);
    expect((await cancel()).status).toBe(200);

    const instructorStillCan = await makeBooking(client, { instructorId: instructor.id, scheduledAt: new Date(Date.now() + 2 * HOUR) });
    await request(app)
      .patch(`/api/v1/instructor/bookings/${instructorStillCan.id}/cancel`)
      .set(auth(instructor))
      .send({ reason: 'Car trouble' })
      .expect(200);
  });

  it('hides other clients\' bookings behind 404', async () => {
    const { instructor, client } = await setup();
    const stranger = await makeClient();
    const booking = await makeBooking(client, { instructorId: instructor.id });

    for (const [method, path, body] of [
      ['get', `/bookings/${booking.id}`],
      ['patch', `/bookings/${booking.id}/cancel`, { reason: 'x' }],
      ['patch', `/bookings/${booking.id}/reschedule`, { scheduledAt: at(dayAhead(6), '10:00'), reason: 'x' }],
      ['post', `/bookings/${booking.id}/pay`],
    ]) {
      const res = await request(app)[method](api(path)).set(auth(stranger)).send(body);
      expect(res.status).toBe(404);
    }
  });
});

describe('client profile', () => {
  it('reads and updates name, phone and saved location', async () => {
    const { client } = await setup();
    const other = await makeClient({ phone: '+639170000999' });
    const patch = (body) => request(app).patch(api('/profile')).set(auth(client)).send(body);

    const empty = await request(app).get(api('/profile')).set(auth(client));
    expect(empty.body.data.profile).toMatchObject({ fullName: 'Ana Reyes', savedLocation: null });

    const updated = await patch({
      fullName: 'Ana R. Reyes',
      phone: '+639171112233',
      savedLocation: { city: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.profile).toMatchObject({
      fullName: 'Ana R. Reyes',
      phone: '+639171112233',
      savedLocation: { city: 'Makati', latitude: 14.5547, longitude: 121.0244 },
    });
    expect(await prisma.auditLog.count({ where: { action: 'CLIENT_PROFILE_UPDATED' } })).toBe(1);

    expect((await patch({ phone: other.phone })).status).toBe(409);
    expect((await patch({ phone: '0917' })).status).toBe(400);
    expect((await patch({ savedLocation: { latitude: 14.5 } })).status).toBe(400);
    expect((await patch({ email: 'x@y.z' })).status).toBe(400);
    expect((await patch({ savedLocation: null })).body.data.profile.savedLocation).toBeNull();
  });
});

describe('admin settings and branch coordinates', () => {
  it('reads defaults, updates with an audit row, and validates ranges', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();

    const before = await request(app).get('/api/v1/admin/settings').set(auth(admin));
    expect(before.body.data.settings).toEqual({
      clientChangeCutoffHours: 24,
      onlinePaymentExpiryMinutes: 30,
      cashAutoCancelHours: 12,
      pricePerHour: 800,
      reservationFee: 1000,
    });

    const res = await request(app).patch('/api/v1/admin/settings').set(auth(admin)).send({ pricePerHour: 950 });
    expect(res.body.data.settings.pricePerHour).toBe(950);
    const log = await prisma.auditLog.findFirst({ where: { action: 'SETTINGS_UPDATED' } });
    expect(log.metadata).toEqual({ changes: { pricePerHour: { from: 800, to: 950 } } });

    expect((await request(app).patch('/api/v1/admin/settings').set(auth(admin)).send({ onlinePaymentExpiryMinutes: 1 })).status).toBe(400);
    expect((await request(app).patch('/api/v1/admin/settings').set(auth(admin)).send({ foo: 1 })).status).toBe(400);
    expect((await request(app).get('/api/v1/admin/settings').set(auth(client))).status).toBe(403);
  });

  it('requires coordinates to create or activate a branch', async () => {
    const admin = await makeAdmin();
    const post = (body) => request(app).post('/api/v1/admin/branches').set(auth(admin)).send(body);
    const closed = await makeBranch({ name: 'Closed', isActive: false });

    expect((await post({ name: 'No Pin' })).status).toBe(400);
    expect((await post({ name: 'Half', latitude: 14.5 })).status).toBe(400);
    expect((await post({ name: 'Pinned', latitude: 14.5547, longitude: 121.0244 })).status).toBe(201);

    const activate = await request(app).patch(`/api/v1/admin/branches/${closed.id}`).set(auth(admin)).send({ isActive: true });
    expect(activate.body.error.code).toBe('BRANCH_COORDINATES_REQUIRED');
    const both = await request(app)
      .patch(`/api/v1/admin/branches/${closed.id}`)
      .set(auth(admin))
      .send({ isActive: true, latitude: 14.4791, longitude: 120.897 });
    expect(both.body.data.branch).toMatchObject({ isActive: true, latitude: 14.4791, longitude: 120.897 });
  });
});
