const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeAdmin, makeClient, makeBooking, makePayment, auth } = require('./factories');

const get = (admin, qs = '') => request(app).get(`/api/v1/admin/payments${qs}`).set(auth(admin));

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/admin/payments', () => {
  it('returns rows in the contract shape, newest first, with a booking or null', async () => {
    const admin = await makeAdmin();
    const client = await makeClient({ fullName: 'Ana Reyes' });
    const booking = await makeBooking(client, { lessonType: 'Parking Skills' });
    await makePayment(client, {
      bookingId: booking.id,
      amount: '1234.5',
      method: 'GCash',
      reference: 'REF-1',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });
    await makePayment(client, { status: 'PENDING', paidAt: null, createdAt: new Date('2026-01-03T00:00:00Z') });

    const res = await get(admin);

    expect(res.status).toBe(200);
    expect(res.body.data[0].booking).toBeNull();
    expect(res.body.data[1]).toEqual({
      id: expect.any(String),
      amount: '1234.50',
      currency: 'PHP',
      status: 'PAID',
      method: 'GCash',
      reference: 'REF-1',
      paidAt: expect.any(String),
      createdAt: '2026-01-02T00:00:00.000Z',
      client: { id: client.id, fullName: 'Ana Reyes', email: client.email },
      booking: {
        id: booking.id,
        lessonType: 'Parking Skills',
        scheduledAt: booking.scheduledAt.toISOString(),
      },
    });
  });

  it('reports overall and per-status totals as 2dp strings, zero-filled', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    await makePayment(client, { amount: '100.10' });
    await makePayment(client, { amount: '200.20' });
    await makePayment(client, { amount: '50.00', status: 'FAILED', paidAt: null });

    const res = await get(admin);

    expect(res.body.meta).toMatchObject({ page: 1, limit: 20, total: 3 });
    expect(res.body.meta.totals).toEqual({
      overall: { count: 3, amount: '350.30' },
      byStatus: {
        PAID: { count: 2, amount: '300.30' },
        PENDING: { count: 0, amount: '0.00' },
        FAILED: { count: 1, amount: '50.00' },
        REFUNDED: { count: 0, amount: '0.00' },
        VOIDED: { count: 0, amount: '0.00' },
      },
    });
  });

  it('returns zeroed totals when nothing matches', async () => {
    const res = await get(await makeAdmin());

    expect(res.body.data).toEqual([]);
    expect(res.body.meta.total).toBe(0);
    expect(res.body.meta.totals.overall).toEqual({ count: 0, amount: '0.00' });
  });

  it('filters by status and applies the same filter to the totals', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    await makePayment(client, { amount: '100.00' });
    await makePayment(client, { amount: '70.00', status: 'FAILED', paidAt: null });

    const res = await get(admin, '?status=FAILED');

    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.totals.overall).toEqual({ count: 1, amount: '70.00' });
    expect(res.body.meta.totals.byStatus.PAID).toEqual({ count: 0, amount: '0.00' });
  });

  it('treats from and to as inclusive whole days in the app timezone', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    await makePayment(client, { createdAt: new Date('2026-01-10T15:59:00Z'), reference: 'before' });
    await makePayment(client, { createdAt: new Date('2026-01-10T16:00:00Z'), reference: 'start' });
    await makePayment(client, { createdAt: new Date('2026-01-11T15:59:00Z'), reference: 'end' });
    await makePayment(client, { createdAt: new Date('2026-01-11T16:00:00Z'), reference: 'after' });

    const res = await get(admin, '?from=2026-01-11&to=2026-01-11');

    expect(res.body.data.map((p) => p.reference).sort()).toEqual(['end', 'start']);
    expect(res.body.meta.totals.overall.count).toBe(2);
  });

  it('searches the client by name or email, case-insensitively', async () => {
    const admin = await makeAdmin();
    const ana = await makeClient({ fullName: 'Ana Reyes', email: 'ana@test.local' });
    const ben = await makeClient({ fullName: 'Ben Cruz', email: 'bcruz@test.local' });
    await makePayment(ana);
    await makePayment(ben);

    const byName = await get(admin, '?client=ANA%20reyes');
    const byEmail = await get(admin, '?client=BCRUZ');

    expect(byName.body.data.map((p) => p.client.id)).toEqual([ana.id]);
    expect(byEmail.body.data.map((p) => p.client.id)).toEqual([ben.id]);
  });

  it('paginates and reports the filtered total', async () => {
    const admin = await makeAdmin();
    const client = await makeClient();
    for (let i = 0; i < 5; i += 1) await makePayment(client);

    const res = await get(admin, '?page=3&limit=2');

    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ page: 3, limit: 2, total: 5 });
  });

  it.each([
    '?limit=101',
    '?page=0',
    '?status=NOPE',
    '?from=2026-13-01',
    '?from=01-01-2026',
    '?from=2026-02-02&to=2026-02-01',
    '?surprise=1',
  ])('rejects invalid query %s', async (qs) => {
    const res = await get(await makeAdmin(), qs);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/v1/admin/overview', () => {
  let nowSpy;

  afterEach(() => nowSpy && nowSpy.mockRestore());

  it('computes todays bookings, monthly revenue, pending bookings and failed payments in APP_TIMEZONE', async () => {
    const admin = await makeAdmin();
    const headers = auth(admin);
    const client = await makeClient();

    // 2026-03-15 12:00 in Asia/Manila. Today is 14 Mar 16:00Z .. 15 Mar 16:00Z,
    // March is 28 Feb 16:00Z .. 31 Mar 16:00Z.
    const at = (iso, overrides = {}) => makeBooking(client, { scheduledAt: new Date(iso), ...overrides });
    await at('2026-03-14T16:00:00Z');
    await at('2026-03-15T15:59:00Z', { status: 'CONFIRMED' });
    await at('2026-03-15T08:00:00Z', { status: 'CANCELLED' });
    await at('2026-03-15T16:00:00Z', { status: 'COMPLETED' });
    await at('2026-03-14T15:59:00Z', { status: 'COMPLETED' });

    const paid = (iso, amount) => makePayment(client, { amount, paidAt: new Date(iso) });
    await paid('2026-02-28T16:00:00Z', '100.50');
    await paid('2026-03-31T15:59:00Z', '200.25');
    await paid('2026-03-31T16:00:00Z', '999.00');
    await paid('2026-02-28T15:59:00Z', '999.00');
    await makePayment(client, { status: 'PENDING', amount: '999.00', paidAt: null });
    await makePayment(client, { status: 'FAILED', amount: '10.00', paidAt: null });
    await makePayment(client, { status: 'FAILED', amount: '10.00', paidAt: null });

    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-15T04:00:00Z'));
    const res = await request(app).get('/api/v1/admin/overview').set(headers);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      todaysBookings: 2,
      revenueThisMonth: { amount: '300.75', currency: 'PHP' },
      pendingBookings: 1,
      failedPayments: 2,
    });
  });

  it('reports zero revenue as 0.00 on an empty database', async () => {
    const res = await request(app).get('/api/v1/admin/overview').set(auth(await makeAdmin()));

    expect(res.body.data).toEqual({
      todaysBookings: 0,
      revenueThisMonth: { amount: '0.00', currency: 'PHP' },
      pendingBookings: 0,
      failedPayments: 0,
    });
  });
});
