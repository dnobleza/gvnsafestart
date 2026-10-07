const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const {
  makeAdmin,
  makeInstructor,
  makeClient,
  makeAvailability,
  makeCatalog,
  auth,
} = require('../admin/factories');
const signature = require('../../src/services/payments/signature');
const { sweep } = require('../../src/jobs/bookingSweeper');
const { dayAhead, at } = require('../instructor/time');

const SECRET = 'whsk_test_unit_secret';
let counter = 0;
const mockCheckout = () =>
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    counter += 1;
    return {
      ok: true,
      json: async () => ({ data: { id: `cs_pkg_${counter}`, attributes: { checkout_url: `https://checkout.paymongo.test/cs_pkg_${counter}` } } }),
    };
  });

const paid = (reference, eventId = `evt_${reference}`) => {
  const raw = JSON.stringify({
    data: { id: eventId, attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: reference } } },
  });
  return request(app)
    .post('/api/v1/payments/webhooks/paymongo')
    .set('Content-Type', 'application/json')
    .set('Paymongo-Signature', signature.header(SECRET, raw))
    .send(raw);
};

beforeEach(resetDb);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const setup = async () => {
  const catalog = await makeCatalog();
  const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
  const client = await makeClient({ fullName: 'Ana Reyes' });
  await makeAvailability(instructor, { startTime: '06:00', endTime: '20:00' });
  return { ...catalog, instructor, client };
};

const buy = (ctx, overrides = {}) =>
  request(app)
    .post('/api/v1/client/packages')
    .set(auth(ctx.client))
    .send({
      packageId: ctx.option2.id,
      serviceAreaId: ctx.area.id,
      trainingType: 'OWN_CAR',
      instructorId: ctx.instructor.id,
      scheduledAt: at(dayAhead(5), '08:00'),
      pickupAddress: '12 Mabini St, Makati',
      paymentMethod: 'CASH',
      ...overrides,
    });

describe('public package catalogue', () => {
  it('lists packages priced for the area and training type, null where no rate exists', async () => {
    const { area, other } = await setup();

    const priced = await request(app).get(`/api/v1/packages?serviceAreaId=${area.id}&trainingType=OWN_CAR`);
    const option2 = priced.body.data.packages.find((p) => p.name === 'Option 2');
    expect(option2).toMatchObject({ sessions: 3, hoursPerSession: 5, totalHours: 15, price: '7000.00', reservationFee: '1000.00' });

    const unpriced = await request(app).get(`/api/v1/packages?serviceAreaId=${other.id}&trainingType=OWN_CAR`);
    expect(unpriced.body.data.packages.every((p) => p.price === null)).toBe(true);
    const rental = await request(app).get(`/api/v1/packages?serviceAreaId=${area.id}&trainingType=CAR_RENTAL`);
    expect(rental.body.data.packages.every((p) => p.price === null)).toBe(true);

    const areas = await request(app).get('/api/v1/service-areas');
    expect(areas.body.data.serviceAreas).toHaveLength(2);
  });
});

describe('POST /client/packages', () => {
  it('buys a package and books session 1 for 5 hours in one transaction', async () => {
    const ctx = await setup();

    const res = await buy(ctx);

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBeNull();
    expect(res.body.data.package).toMatchObject({
      name: 'Option 2',
      price: '7000.00',
      reservationFee: '1000.00',
      amountPaid: '0.00',
      balance: '7000.00',
      paymentStatus: 'AWAITING_CASH',
      sessionsTotal: 3,
      sessionsUsed: 1,
      sessionsRemaining: 2,
      canBookNext: true,
      pickupAddress: '12 Mabini St, Makati',
      trainingType: 'OWN_CAR',
    });
    const booking = await prisma.booking.findFirst();
    expect(booking).toMatchObject({ durationMinutes: 300, sessionNumber: 1, lessonType: 'Option 2', status: 'PENDING' });
    expect(await prisma.notification.count({ where: { userId: ctx.instructor.id, type: 'BOOKING_CREATED' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'PACKAGE_PURCHASED' } })).toBe(1);
  });

  it('refuses unpriced combinations and rolls back when the slot is taken', async () => {
    const ctx = await setup();

    const noRate = await buy(ctx, { serviceAreaId: ctx.other.id });
    expect(noRate.status).toBe(400);
    expect(noRate.body.error.code).toBe('RATE_NOT_SET');

    await buy(ctx).expect(201);
    const other = await makeClient();
    const clash = await request(app)
      .post('/api/v1/client/packages')
      .set(auth(other))
      .send({
        packageId: ctx.option1.id,
        serviceAreaId: ctx.area.id,
        trainingType: 'OWN_CAR',
        instructorId: ctx.instructor.id,
        scheduledAt: at(dayAhead(5), '10:00'),
        pickupAddress: 'Somewhere 123',
        paymentMethod: 'CASH',
      });
    expect(clash.status).toBe(409);
    expect(await prisma.clientPackage.count()).toBe(1);

    const tooLong = await buy(ctx, { packageId: ctx.option3.id, scheduledAt: at(dayAhead(6), '10:00') });
    expect(tooLong.body.error.code).toBe('OUTSIDE_AVAILABILITY');
    expect((await buy(ctx, { packageId: ctx.option3.id, scheduledAt: at(dayAhead(6), '07:00') })).status).toBe(201);
  });

  it('rejects client_id in the body and requires a pickup address', async () => {
    const ctx = await setup();
    expect((await buy(ctx, { clientId: ctx.instructor.id })).status).toBe(400);
    expect((await buy(ctx, { pickupAddress: '' })).status).toBe(400);
  });
});

describe('remaining sessions', () => {
  it('books the next sessions with the same instructor and length, and returns credit on cancel', async () => {
    const ctx = await setup();
    const id = (await buy(ctx)).body.data.package.id;
    const next = (day) =>
      request(app).post(`/api/v1/client/packages/${id}/sessions`).set(auth(ctx.client)).send({ scheduledAt: at(dayAhead(day), '08:00') });

    const second = await next(6);
    expect(second.status).toBe(201);
    expect(second.body.data.package).toMatchObject({ sessionsUsed: 2, sessionsRemaining: 1 });
    await next(7).expect(201);
    const fourth = await next(8);
    expect(fourth.status).toBe(400);
    expect(fourth.body.error.code).toBe('NO_SESSIONS_LEFT');

    const sessions = await prisma.booking.findMany({ where: { clientPackageId: id }, orderBy: { sessionNumber: 'asc' } });
    expect(sessions.map((s) => [s.sessionNumber, s.durationMinutes, s.instructorId])).toEqual([
      [1, 300, ctx.instructor.id],
      [2, 300, ctx.instructor.id],
      [3, 300, ctx.instructor.id],
    ]);

    await request(app).patch(`/api/v1/client/bookings/${sessions[2].id}/cancel`).set(auth(ctx.client)).send({ reason: 'Busy' }).expect(200);
    const detail = await request(app).get(`/api/v1/client/packages/${id}`).set(auth(ctx.client));
    expect(detail.body.data.package).toMatchObject({ sessionsUsed: 2, sessionsRemaining: 1, canBookNext: true });

    const stranger = await makeClient();
    expect((await request(app).get(`/api/v1/client/packages/${id}`).set(auth(stranger))).status).toBe(404);
  });
});

describe('package payments', () => {
  it('reservation online, then balance in cash with a receipt, ends PAID', async () => {
    const ctx = await setup();
    mockCheckout();
    const res = await buy(ctx, { paymentMethod: 'ONLINE' });
    const id = res.body.data.package.id;
    expect(res.body.data.checkoutUrl).toMatch(/checkout\.paymongo\.test/);
    expect(res.body.data.package).toMatchObject({ paymentStatus: 'UNPAID', amountDue: '1000.00', canBookNext: false });
    expect((await prisma.payment.findFirst()).amount.toString()).toBe('1000');

    const blocked = await request(app)
      .post(`/api/v1/client/packages/${id}/sessions`)
      .set(auth(ctx.client))
      .send({ scheduledAt: at(dayAhead(6), '08:00') });
    expect(blocked.body.error.code).toBe('PAYMENT_REQUIRED');

    const reference = (await prisma.payment.findFirst()).providerReference;
    await paid(reference).expect(200);
    await paid(reference).expect(200);
    const reserved = await request(app).get(`/api/v1/client/packages/${id}`).set(auth(ctx.client));
    expect(reserved.body.data.package).toMatchObject({ paymentStatus: 'RESERVED', amountPaid: '1000.00', balance: '6000.00', canBookNext: true });
    const session = await prisma.booking.findFirst({ where: { clientPackageId: id } });
    expect(session).toMatchObject({ paymentStatus: 'AWAITING_CASH', paymentDueAt: null });

    await request(app).patch(`/api/v1/instructor/bookings/${session.id}/confirm`).set(auth(ctx.instructor)).expect(200);
    const cash = await request(app)
      .post(`/api/v1/instructor/bookings/${session.id}/cash`)
      .set(auth(ctx.instructor))
      .send({});
    expect(cash.status).toBe(201);
    expect(cash.body.data.booking.package).toMatchObject({ paymentStatus: 'PAID', balance: '0.00', sessionNumber: 1, sessionsTotal: 3 });
    expect((await prisma.payment.findFirst({ where: { method: 'Cash' } })).amount.toString()).toBe('6000');

    const done = await request(app).get(`/api/v1/client/packages/${id}`).set(auth(ctx.client));
    expect(done.body.data.package.payments.map((p) => [p.method, p.amount, p.receiptNumber])).toEqual([
      ['Online', '1000.00', null],
      ['Cash', '6000.00', expect.stringMatching(/^OR-\d{4}-\d{6}$/)],
    ]);
    expect(done.body.data.package.canPay).toBe(false);
  });

  it('pays the balance online after a cash reservation', async () => {
    const ctx = await setup();
    mockCheckout();
    const id = (await buy(ctx)).body.data.package.id;
    const pay = () => request(app).post(`/api/v1/client/packages/${id}/pay`).set(auth(ctx.client));

    const first = await pay();
    expect(first.body.data.amount).toBe(1000);
    await paid((await prisma.payment.findFirst({ where: { status: 'PENDING' } })).providerReference).expect(200);

    const second = await pay();
    expect(second.body.data.amount).toBe(6000);
    await paid((await prisma.payment.findFirst({ where: { status: 'PENDING' } })).providerReference).expect(200);

    expect(await prisma.clientPackage.findUnique({ where: { id } })).toMatchObject({ paymentStatus: 'PAID' });
    expect((await pay()).status).toBe(409);
    const sessionPay = await request(app)
      .post(`/api/v1/client/bookings/${(await prisma.booking.findFirst()).id}/pay`)
      .set(auth(ctx.client));
    expect(sessionPay.status).toBe(409);
  });

  it('does not count an online payment twice when cash already covered the package', async () => {
    const ctx = await setup();
    mockCheckout();
    const id = (await buy(ctx)).body.data.package.id;
    await request(app).post(`/api/v1/client/packages/${id}/pay`).set(auth(ctx.client)).expect(200);
    const session = await prisma.booking.findFirst({ where: { clientPackageId: id } });
    await request(app).patch(`/api/v1/instructor/bookings/${session.id}/confirm`).set(auth(ctx.instructor)).expect(200);
    await request(app).post(`/api/v1/instructor/bookings/${session.id}/cash`).set(auth(ctx.instructor)).send({}).expect(201);

    const online = await prisma.payment.findFirst({ where: { method: 'Online' } });
    const res = await paid(online.providerReference);

    expect(res.body.data.status).toBe('refund_needed');
    expect(await prisma.clientPackage.findUnique({ where: { id } })).toMatchObject({ paymentStatus: 'PAID' });
    expect((await prisma.clientPackage.findUnique({ where: { id } })).amountPaid.toString()).toBe('7000');
    const history = await prisma.bookingHistory.findFirst({ where: { bookingId: session.id, action: 'PAYMENT_RECEIVED' } });
    expect(history.reason).toBe('Paid online after it was already paid; refund needed');
  });

  it('expires an unpaid online reservation and cancels its sessions as System', async () => {
    const ctx = await setup();
    mockCheckout();
    const id = (await buy(ctx, { paymentMethod: 'ONLINE' })).body.data.package.id;

    const result = await sweep(new Date(Date.now() + 31 * 60000));

    expect(result.expiredPackages).toBe(1);
    expect((await prisma.clientPackage.findUnique({ where: { id } })).status).toBe('CANCELLED');
    const session = await prisma.booking.findFirst({ where: { clientPackageId: id } });
    expect(session.status).toBe('CANCELLED');
    const h = await prisma.bookingHistory.findFirst({ where: { bookingId: session.id, action: 'CANCELLED' } });
    expect(h).toMatchObject({ changedByRole: 'SYSTEM', reason: 'Reservation fee was not paid in time' });
  });

  it('cancels a whole package, respecting the cutoff', async () => {
    const ctx = await setup();
    const id = (await buy(ctx)).body.data.package.id;
    const admin = await makeAdmin();
    await request(app).patch('/api/v1/admin/settings').set(auth(admin)).send({ clientChangeCutoffHours: 72 }).expect(200);
    const soon = (await buy(ctx, { scheduledAt: at(dayAhead(2), '08:00') })).body.data.package;

    const blocked = await request(app).patch(`/api/v1/client/packages/${soon.id}/cancel`).set(auth(ctx.client)).send({ reason: 'x' });
    expect(blocked.body.error.code).toBe('CHANGE_WINDOW_CLOSED');

    const res = await request(app).patch(`/api/v1/client/packages/${id}/cancel`).set(auth(ctx.client)).send({ reason: 'Moving abroad' });
    expect(res.body.data.package).toMatchObject({ status: 'CANCELLED', canBookNext: false });
    expect(await prisma.notification.count({ where: { userId: ctx.instructor.id, type: 'BOOKING_CANCELLED' } })).toBe(1);
  });
});

describe('admin catalogue', () => {
  it('edits the rate grid with an audit row, and toggles areas and packages', async () => {
    const ctx = await setup();
    const admin = await makeAdmin();

    const grid = await request(app).get('/api/v1/admin/package-rates?trainingType=CAR_RENTAL').set(auth(admin));
    expect(grid.body.data.rates).toEqual([]);

    const saved = await request(app)
      .put('/api/v1/admin/package-rates')
      .set(auth(admin))
      .send({
        trainingType: 'CAR_RENTAL',
        rates: [
          { packageId: ctx.option1.id, serviceAreaId: ctx.area.id, price: 3500 },
          { packageId: ctx.option2.id, serviceAreaId: ctx.area.id, price: null },
        ],
      });
    expect(saved.body.data.rates).toEqual([{ packageId: ctx.option1.id, serviceAreaId: ctx.area.id, price: '3500.00' }]);
    const log = await prisma.auditLog.findFirst({ where: { action: 'PACKAGE_RATES_UPDATED' } });
    expect(log.metadata.changes).toHaveLength(1);

    await request(app)
      .put('/api/v1/admin/package-rates')
      .set(auth(admin))
      .send({ trainingType: 'OWN_CAR', rates: [{ packageId: ctx.option1.id, serviceAreaId: ctx.area.id, price: null }] })
      .expect(200);
    expect((await buy(ctx, { packageId: ctx.option1.id })).body.error.code).toBe('RATE_NOT_SET');

    await request(app).patch(`/api/v1/admin/service-areas/${ctx.other.id}`).set(auth(admin)).send({ isActive: false }).expect(200);
    expect((await request(app).get('/api/v1/service-areas')).body.data.serviceAreas).toHaveLength(1);
    await request(app).patch(`/api/v1/admin/packages/${ctx.option3.id}`).set(auth(admin)).send({ isActive: false }).expect(200);
    const pkgs = await request(app).get(`/api/v1/packages?serviceAreaId=${ctx.area.id}&trainingType=OWN_CAR`);
    expect(pkgs.body.data.packages.map((p) => p.name)).not.toContain('Option 3');
    expect((await request(app).get('/api/v1/admin/packages').set(auth(ctx.client))).status).toBe(403);
  });
});
