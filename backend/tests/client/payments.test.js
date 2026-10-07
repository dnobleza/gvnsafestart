const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeInstructor, makeClient, makeBooking, makeAvailability, auth } = require('../admin/factories');
const signature = require('../../src/services/payments/signature');
const { sweep } = require('../../src/jobs/bookingSweeper');
const { dayAhead, at } = require('../instructor/time');

const SECRET = 'whsk_test_unit_secret';
const WEBHOOK = '/api/v1/payments/webhooks/paymongo';

let counter = 0;

const mockCheckout = () =>
  jest.spyOn(global, 'fetch').mockImplementation(async () => {
    counter += 1;
    return {
      ok: true,
      json: async () => ({ data: { id: `cs_test_${counter}`, attributes: { checkout_url: `https://checkout.paymongo.test/cs_test_${counter}` } } }),
    };
  });

const paidEvent = (reference, eventId = `evt_${reference}`) =>
  JSON.stringify({
    data: {
      id: eventId,
      type: 'event',
      attributes: { type: 'checkout_session.payment.paid', livemode: false, data: { id: reference, type: 'checkout_session' } },
    },
  });

const sendWebhook = (raw, header = signature.header(SECRET, raw)) =>
  request(app).post(WEBHOOK).set('Content-Type', 'application/json').set('Paymongo-Signature', header).send(raw);

beforeEach(resetDb);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const setup = async () => {
  const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
  const client = await makeClient({ fullName: 'Ana Reyes' });
  await makeAvailability(instructor);
  return { instructor, client };
};

const book = (client, instructor, paymentMethod, hhmm = '10:00', day = dayAhead(5)) =>
  request(app)
    .post('/api/v1/client/bookings')
    .set(auth(client))
    .send({ instructorId: instructor.id, scheduledAt: at(day, hhmm), durationMinutes: 90, lessonType: 'Basic Driving', paymentMethod });

describe('booking with a payment method', () => {
  it('cash: awaiting cash with a price snapshot and no checkout', async () => {
    const { instructor, client } = await setup();
    const fetchSpy = mockCheckout();

    const res = await book(client, instructor, 'CASH');

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toBeNull();
    expect(res.body.data.booking).toMatchObject({ paymentMethod: 'CASH', paymentStatus: 'AWAITING_CASH', price: '1200.00', paymentDueAt: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('online: unpaid with a deadline and a PayMongo checkout URL', async () => {
    const { instructor, client } = await setup();
    const fetchSpy = mockCheckout();

    const res = await book(client, instructor, 'ONLINE');

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toMatch(/^https:\/\/checkout\.paymongo\.test\//);
    expect(res.body.data.booking).toMatchObject({ paymentMethod: 'ONLINE', paymentStatus: 'UNPAID' });
    expect(new Date(res.body.data.booking.paymentDueAt).getTime()).toBeGreaterThan(Date.now() + 29 * 60000);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://paymongo.test/v1/checkout_sessions');
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('sk_test_unit:').toString('base64')}`);
    const body = JSON.parse(init.body).data.attributes;
    expect(body.line_items[0]).toMatchObject({ amount: 120000, currency: 'PHP', quantity: 1 });
    expect(body.reference_number).toBe(res.body.data.booking.id);
    expect(body.success_url).toBe(`http://localhost:5173/client/bookings/${res.body.data.booking.id}?payment=return`);

    const payment = await prisma.payment.findFirst();
    expect(payment).toMatchObject({ status: 'PENDING', provider: 'PAYMONGO', providerReference: 'cs_test_' + counter });
  });

  it('rejects a client_id or unknown payment method in the body', async () => {
    const { instructor, client } = await setup();
    const other = await makeClient();
    const base = { instructorId: instructor.id, scheduledAt: at(dayAhead(5), '10:00'), durationMinutes: 60, lessonType: 'Basic Driving' };

    for (const body of [{ ...base, paymentMethod: 'CASH', clientId: other.id }, { ...base, client_id: other.id, paymentMethod: 'CASH' }, { ...base, paymentMethod: 'GCASH' }]) {
      expect((await request(app).post('/api/v1/client/bookings').set(auth(client)).send(body)).status).toBe(400);
    }
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe('PayMongo webhook', () => {
  const startOnline = async () => {
    const { instructor, client } = await setup();
    mockCheckout();
    const res = await book(client, instructor, 'ONLINE');
    const payment = await prisma.payment.findFirst();
    return { instructor, client, booking: res.body.data.booking, reference: payment.providerReference };
  };

  it('rejects a bad, missing or stale signature and leaves the booking unpaid', async () => {
    const { booking, reference } = await startOnline();
    const raw = paidEvent(reference);

    expect((await sendWebhook(raw, signature.header('wrong-secret', raw))).status).toBe(401);
    expect((await sendWebhook(raw, '')).status).toBe(401);
    const stale = signature.header(SECRET, raw, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect((await sendWebhook(raw, stale)).status).toBe(401);
    const tampered = raw.replace('checkout_session.payment.paid', 'checkout_session.payment.paid ');
    expect((await sendWebhook(tampered, signature.header(SECRET, raw))).status).toBe(401);

    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).paymentStatus).toBe('UNPAID');
  });

  it('marks paid once, records history as System, notifies both sides, and ignores a duplicate', async () => {
    const { instructor, client, booking, reference } = await startOnline();
    const raw = paidEvent(reference);

    const first = await sendWebhook(raw);
    expect(first.status).toBe(200);
    expect(first.body.data).toEqual({ status: 'paid', bookingId: booking.id });

    const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(stored).toMatchObject({ paymentStatus: 'PAID', paymentMethod: 'ONLINE', paymentDueAt: null });
    expect((await prisma.payment.findFirst()).status).toBe('PAID');
    const history = await prisma.bookingHistory.findMany({ where: { bookingId: booking.id, action: 'PAYMENT_RECEIVED' } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ changedById: null, changedByRole: 'SYSTEM' });
    expect(await prisma.notification.count({ where: { userId: client.id, type: 'PAYMENT_RECEIVED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: instructor.id, type: 'PAYMENT_RECEIVED' } })).toBe(1);

    const again = await sendWebhook(raw);
    expect(again.status).toBe(200);
    expect(again.body.data.status).toBe('duplicate');
    const sameCheckoutNewEvent = await sendWebhook(paidEvent(reference, 'evt_other'));
    expect(sameCheckoutNewEvent.body.data.status).toBe('already_paid');
    expect(await prisma.bookingHistory.count({ where: { action: 'PAYMENT_RECEIVED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { type: 'PAYMENT_RECEIVED' } })).toBe(2);
  });

  it('acknowledges unrelated events without changing anything', async () => {
    const { booking } = await startOnline();
    const raw = JSON.stringify({ data: { id: 'evt_x', attributes: { type: 'payment.failed', livemode: false, data: { id: 'pay_1' } } } });

    const res = await sendWebhook(raw);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ignored');
    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).paymentStatus).toBe('UNPAID');
  });

  it('the return redirect alone never marks a booking paid', async () => {
    const { client, booking } = await startOnline();

    const res = await request(app).get(`/api/v1/client/bookings/${booking.id}`).set(auth(client));

    expect(res.body.data.booking).toMatchObject({ paymentStatus: 'UNPAID', canPay: true });
  });
});

describe('POST /client/bookings/:id/pay', () => {
  it('reuses an open checkout, and lets a cash booking switch to online until paid', async () => {
    const { instructor, client } = await setup();
    const fetchSpy = mockCheckout();
    const cash = (await book(client, instructor, 'CASH')).body.data.booking;
    const pay = () => request(app).post(`/api/v1/client/bookings/${cash.id}/pay`).set(auth(client));

    const first = await pay();
    const second = await pay();
    expect(first.status).toBe(200);
    expect(second.body.data.checkoutUrl).toBe(first.body.data.checkoutUrl);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((await prisma.booking.findUnique({ where: { id: cash.id } })).paymentStatus).toBe('AWAITING_CASH');

    const payment = await prisma.payment.findFirst();
    await sendWebhook(paidEvent(payment.providerReference)).expect(200);
    expect(await prisma.booking.findUnique({ where: { id: cash.id } })).toMatchObject({ paymentMethod: 'ONLINE', paymentStatus: 'PAID' });

    const paid = await pay();
    expect(paid.status).toBe(409);
    expect(paid.body.error.code).toBe('ALREADY_PAID');
  });

  it('refuses other clients, cancelled bookings, and reports provider failures', async () => {
    const { instructor, client } = await setup();
    const stranger = await makeClient();
    const booking = await makeBooking(client, { instructorId: instructor.id });
    const cancelled = await makeBooking(client, { instructorId: instructor.id, status: 'CANCELLED' });
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: false, json: async () => ({ errors: [{ detail: 'bad key' }] }) });

    expect((await request(app).post(`/api/v1/client/bookings/${booking.id}/pay`).set(auth(stranger))).status).toBe(404);
    expect((await request(app).post(`/api/v1/client/bookings/${cancelled.id}/pay`).set(auth(client))).body.error.code).toBe('PAYMENT_NOT_ALLOWED');
    const failed = await request(app).post(`/api/v1/client/bookings/${booking.id}/pay`).set(auth(client));
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('PAYMENT_PROVIDER_ERROR');
  });
});

describe('cash recorded by the instructor', () => {
  it('issues an OR number, uses the booking price, and marks the booking paid', async () => {
    const { instructor, client } = await setup();
    const booking = (await book(client, instructor, 'CASH')).body.data.booking;
    await request(app).patch(`/api/v1/instructor/bookings/${booking.id}/confirm`).set(auth(instructor)).expect(200);
    const cash = (body) => request(app).post(`/api/v1/instructor/bookings/${booking.id}/cash`).set(auth(instructor)).send(body);

    expect((await cash({ receiptNumber: 'MY-OWN' })).status).toBe(400);
    const res = await cash({});
    expect(res.status).toBe(201);
    const or = res.body.data.booking.receiptNumber;
    expect(or).toMatch(new RegExp(`^OR-${new Date().getFullYear()}-\\d{6}$`));
    expect(res.body.data.booking.paymentStatus).toBe('PAID');
    expect((await prisma.payment.findFirst()).amount.toString()).toBe('1200');

    const detail = await request(app).get(`/api/v1/client/bookings/${booking.id}`).set(auth(client));
    expect(detail.body.data.booking).toMatchObject({ paymentStatus: 'PAID', receiptNumber: or, canPay: false });
  });
});

describe('booking sweeper', () => {
  it('cancels expired online bookings and unconfirmed cash bookings close to the session, as System', async () => {
    const { instructor, client } = await setup();
    mockCheckout();
    const online = (await book(client, instructor, 'ONLINE', '09:00')).body.data.booking;
    const soonCash = await makeBooking(client, { instructorId: instructor.id, scheduledAt: new Date(Date.now() + 3 * 3600000) });
    const laterCash = await makeBooking(client, { instructorId: instructor.id, scheduledAt: new Date(Date.now() + 48 * 3600000) });
    const confirmedSoon = await makeBooking(client, { instructorId: instructor.id, status: 'CONFIRMED', scheduledAt: new Date(Date.now() + 2 * 3600000) });

    expect(await sweep(new Date())).toEqual({ expiredPackages: 0, expiredOnline: 0, staleCash: 1 });
    expect(await sweep(new Date(Date.now() + 31 * 60000))).toEqual({ expiredPackages: 0, expiredOnline: 1, staleCash: 0 });

    const status = async (id) => (await prisma.booking.findUnique({ where: { id } })).status;
    expect(await status(online.id)).toBe('CANCELLED');
    expect(await status(soonCash.id)).toBe('CANCELLED');
    expect(await status(laterCash.id)).toBe('PENDING');
    expect(await status(confirmedSoon.id)).toBe('CONFIRMED');

    const h = await prisma.bookingHistory.findFirst({ where: { bookingId: online.id, action: 'CANCELLED' } });
    expect(h).toMatchObject({ changedByRole: 'SYSTEM', changedById: null, reason: 'Online payment was not completed in time' });
    const note = await prisma.notification.findFirst({ where: { userId: client.id, bookingId: online.id } });
    expect(note.message).toContain('Online payment was not completed in time');
  });
});
