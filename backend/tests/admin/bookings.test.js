const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeAdmin, makeClient, makeBooking, auth } = require('./factories');

const FUTURE = '2999-06-01T02:00:00.000Z';
const url = (id, action) => `/api/v1/admin/bookings/${id}/${action}`;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/admin/bookings', () => {
  it('returns rows in the contract shape with pagination meta', async () => {
    const admin = await makeAdmin();
    const client = await makeClient({ fullName: 'Ana Reyes', phone: '+639171234567' });
    await makeBooking(client, { area: 'Makati', notes: 'Bring licence' });

    const res = await request(app).get('/api/v1/admin/bookings').set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 1 });
    expect(res.body.data[0]).toEqual({
      id: expect.any(String),
      lessonType: 'Defensive Driving',
      area: 'Makati',
      scheduledAt: expect.any(String),
      durationMinutes: 60,
      endsAt: expect.any(String),
      status: 'PENDING',
      notes: 'Bring licence',
      cancelReason: null,
      createdAt: expect.any(String),
      paymentMethod: 'CASH',
      paymentStatus: 'AWAITING_CASH',
      price: null,
      paymentDueAt: null,
      receiptNumber: null,
      payments: [],
      instructor: null,
      lastAction: null,
      rated: false,
      package: null,
      autoCompleted: false,
      autoCompletedAt: null,
      cashUnpaid: false,
      client: { id: client.id, fullName: 'Ana Reyes', email: client.email, phone: '+639171234567' },
    });
  });

  it('filters by status, client name and date range, and paginates', async () => {
    const admin = await makeAdmin();
    const ana = await makeClient({ fullName: 'Ana Reyes' });
    const ben = await makeClient({ fullName: 'Ben Cruz' });
    await makeBooking(ana, { scheduledAt: new Date('2026-01-10T03:00:00Z') });
    await makeBooking(ana, { scheduledAt: new Date('2026-01-11T15:00:00Z'), status: 'CONFIRMED' });
    await makeBooking(ben, { scheduledAt: new Date('2026-01-11T16:00:00Z') });

    const get = (qs) => request(app).get(`/api/v1/admin/bookings?${qs}`).set(auth(admin));

    expect((await get('status=CONFIRMED')).body.meta.total).toBe(1);
    expect((await get('client=ANA')).body.meta.total).toBe(2);
    expect((await get('from=2026-01-11&to=2026-01-11')).body.meta.total).toBe(1);
    const page = await get('page=2&limit=2');
    expect(page.body.meta).toEqual({ page: 2, limit: 2, total: 3 });
    expect(page.body.data).toHaveLength(1);
  });

  it('rejects bad query values', async () => {
    const admin = await makeAdmin();

    const bad = await request(app).get('/api/v1/admin/bookings?status=NOPE').set(auth(admin));
    const order = await request(app)
      .get('/api/v1/admin/bookings?from=2026-02-02&to=2026-02-01')
      .set(auth(admin));

    expect(bad.status).toBe(400);
    expect(order.status).toBe(400);
  });
});

describe('POST /api/v1/admin/bookings/:id/approve', () => {
  it('moves PENDING to CONFIRMED', async () => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient());

    const res = await request(app).post(url(booking.id, 'approve')).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({ id: booking.id, status: 'CONFIRMED' });
    expect(res.body.data.booking.client).toHaveProperty('phone');
  });

  it.each(['CONFIRMED', 'CANCELLED', 'COMPLETED'])('refuses a %s booking with 400', async (status) => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient(), { status });

    const res = await request(app).post(url(booking.id, 'approve')).set(auth(admin));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BOOKING_TRANSITION');
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('returns 404 BOOKING_NOT_FOUND for an unknown id', async () => {
    const admin = await makeAdmin();

    const res = await request(app)
      .post(url('00000000-0000-4000-8000-000000000000', 'approve'))
      .set(auth(admin));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });
});

describe('POST /api/v1/admin/bookings/:id/reschedule', () => {
  it.each(['PENDING', 'CONFIRMED'])('reschedules a %s booking and keeps its status', async (status) => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient(), { status });

    const res = await request(app)
      .post(url(booking.id, 'reschedule'))
      .set(auth(admin))
      .send({ scheduledAt: FUTURE, reason: 'Moved' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe(status);
    expect(new Date(res.body.data.booking.scheduledAt).toISOString()).toBe(FUTURE);
  });

  it.each(['CANCELLED', 'COMPLETED'])('refuses a %s booking with 400', async (status) => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient(), { status });

    const res = await request(app)
      .post(url(booking.id, 'reschedule'))
      .set(auth(admin))
      .send({ scheduledAt: FUTURE, reason: 'Moved' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BOOKING_TRANSITION');
  });

  it('rejects a past date, a non-ISO value, and a missing body', async () => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient());
    const post = (body) =>
      request(app).post(url(booking.id, 'reschedule')).set(auth(admin)).send(body);

    for (const body of [{ scheduledAt: '2000-01-01T00:00:00Z' }, { scheduledAt: 'tomorrow' }, {}]) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('POST /api/v1/admin/bookings/:id/cancel', () => {
  it.each(['PENDING', 'CONFIRMED'])('cancels a %s booking and stores the reason', async (status) => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient(), { status });

    const res = await request(app)
      .post(url(booking.id, 'cancel'))
      .set(auth(admin))
      .send({ reason: 'Instructor unavailable' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Instructor unavailable',
    });
  });

  it('requires a reason', async () => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient());

    for (const body of [{}, { reason: '   ' }]) {
      const res = await request(app).post(url(booking.id, 'cancel')).set(auth(admin)).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('PENDING');
  });

  it.each(['CANCELLED', 'COMPLETED'])('refuses a %s booking with 400', async (status) => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient(), { status });

    const res = await request(app).post(url(booking.id, 'cancel')).set(auth(admin)).send({ reason: 'Client asked' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BOOKING_TRANSITION');
  });

  it('refuses a second cancel of the same booking', async () => {
    const admin = await makeAdmin();
    const booking = await makeBooking(await makeClient());

    await request(app).post(url(booking.id, 'cancel')).set(auth(admin)).send({ reason: 'Client asked' }).expect(200);
    const again = await request(app).post(url(booking.id, 'cancel')).set(auth(admin)).send({ reason: 'Client asked' });

    expect(again.status).toBe(400);
    expect(await prisma.auditLog.count({ where: { action: 'BOOKING_CANCELLED' } })).toBe(1);
  });
});
