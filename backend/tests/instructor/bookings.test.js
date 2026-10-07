const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const {
  makeAdmin,
  makeInstructor,
  makeClient,
  makeBooking,
  makeAvailability,
  auth,
} = require('../admin/factories');
const notificationService = require('../../src/services/notification.service');
const consoleEmail = require('../../src/services/email/console.sender');
const { dayAhead, at } = require('./time');

const base = '/api/v1/instructor/bookings';
const patch = (user, id, action, body = {}) =>
  request(app).patch(`${base}/${id}/${action}`).set(auth(user)).send(body);

const HOUR = 3600000;

beforeEach(resetDb);
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const setup = async () => {
  const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
  const other = await makeInstructor();
  const client = await makeClient({ fullName: 'Ana Reyes' });
  await makeAvailability(instructor);
  return { instructor, other, client };
};

const bookFor = (client, instructor, overrides = {}) =>
  makeBooking(client, { instructorId: instructor.id, scheduledAt: at(dayAhead(10), '10:00'), ...overrides });

describe('instructor access', () => {
  it('requires the INSTRUCTOR role', async () => {
    const { client } = await setup();
    const admin = await makeAdmin();

    expect((await request(app).get(base)).status).toBe(401);
    expect((await request(app).get(base).set(auth(client))).status).toBe(403);
    expect((await request(app).get(base).set(auth(admin))).status).toBe(403);
  });

  it('lists only my bookings and hides other instructors\' bookings behind 404', async () => {
    const { instructor, other, client } = await setup();
    const mine = await bookFor(client, instructor);
    const theirs = await bookFor(client, other);

    const res = await request(app).get(base).set(auth(instructor));
    expect(res.body.data.map((b) => b.id)).toEqual([mine.id]);
    expect(res.body.data[0].client).toEqual({ id: client.id, fullName: 'Ana Reyes', phone: null });

    for (const action of ['confirm', 'complete', 'no-show']) {
      const r = await patch(instructor, theirs.id, action);
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe('BOOKING_NOT_FOUND');
    }
    expect((await request(app).get(`${base}/${theirs.id}/history`).set(auth(instructor))).status).toBe(404);
    expect((await request(app).get(`${base}/${theirs.id}`).set(auth(instructor))).status).toBe(404);
    expect((await patch(instructor, theirs.id, 'cancel', { reason: 'x' })).status).toBe(404);
  });

  it('filters by status and date range and paginates', async () => {
    const { instructor, client } = await setup();
    await bookFor(client, instructor, { scheduledAt: at(dayAhead(3), '09:00') });
    await bookFor(client, instructor, { scheduledAt: at(dayAhead(4), '09:00'), status: 'CONFIRMED' });
    await bookFor(client, instructor, { scheduledAt: at(dayAhead(5), '09:00') });
    const get = (qs) => request(app).get(`${base}?${qs}`).set(auth(instructor));

    expect((await get('status=CONFIRMED')).body.meta.total).toBe(1);
    expect((await get(`from=${dayAhead(4)}&to=${dayAhead(5)}`)).body.meta.total).toBe(2);
    expect((await get('page=2&limit=2')).body.data).toHaveLength(1);
    expect((await get('status=APPROVED')).status).toBe(400);
  });
});

describe('PATCH confirm', () => {
  it('confirms in one transaction: status, last action, history, audit and client notification', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);

    const res = await patch(instructor, booking.id, 'confirm', { changed_by: client.id, instructor_id: client.id });

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({ status: 'CONFIRMED' });
    expect(res.body.data.booking.lastAction).toMatchObject({
      action: 'CONFIRMED',
      actorName: 'Juan Dela Cruz',
      actorRole: 'INSTRUCTOR',
    });

    const stored = await prisma.booking.findUnique({ where: { id: booking.id } });
    expect(stored.lastActionById).toBe(instructor.id);
    expect(stored.lastActionAt).not.toBeNull();
    expect(stored.instructorId).toBe(instructor.id);

    const history = await prisma.bookingHistory.findMany({ where: { bookingId: booking.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      action: 'CONFIRMED',
      fromStatus: 'PENDING',
      toStatus: 'CONFIRMED',
      changedById: instructor.id,
      changedByRole: 'INSTRUCTOR',
    });

    expect(await prisma.auditLog.count({ where: { action: 'BOOKING_CONFIRMED', actorId: instructor.id } })).toBe(1);

    const notes = await prisma.notification.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ userId: client.id, type: 'BOOKING_CONFIRMED', bookingId: booking.id });
  });

  it.each([
    ['confirm', 'CONFIRMED'],
    ['confirm', 'COMPLETED'],
    ['complete', 'PENDING'],
    ['no-show', 'PENDING'],
    ['complete', 'CANCELLED'],
    ['no-show', 'NO_SHOW'],
  ])('refuses %s on a %s booking with 400', async (action, status) => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor, { status, scheduledAt: new Date(Date.now() - HOUR) });

    const res = await patch(instructor, booking.id, action);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_BOOKING_TRANSITION');
    expect(await prisma.bookingHistory.count()).toBe(0);
  });

  it('rolls everything back when a step inside the transaction fails', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);
    jest.spyOn(notificationService, 'notify').mockRejectedValueOnce(new Error('boom'));

    const res = await patch(instructor, booking.id, 'confirm');

    expect(res.status).toBe(500);
    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('PENDING');
    expect(await prisma.bookingHistory.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  it('still succeeds when the email fails, and logs instead', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);
    const send = jest.spyOn(consoleEmail, 'send').mockRejectedValue(new Error('smtp down'));

    const res = await patch(instructor, booking.id, 'confirm');

    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: client.email, subject: 'Booking confirmed' }));
    expect((await prisma.booking.findUnique({ where: { id: booking.id } })).status).toBe('CONFIRMED');
    expect(await prisma.notification.count()).toBe(1);
  });
});

describe('PATCH complete / no-show', () => {
  it('is refused before the session start time', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor, { status: 'CONFIRMED' });

    for (const action of ['complete', 'no-show']) {
      const res = await patch(instructor, booking.id, action);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('SESSION_NOT_STARTED');
    }
  });

  it.each([
    ['complete', 'COMPLETED'],
    ['no-show', 'NO_SHOW'],
  ])('%s works after the start time', async (action, status) => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor, { status: 'CONFIRMED', scheduledAt: new Date(Date.now() - HOUR) });

    const res = await patch(instructor, booking.id, action);

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe(status);
    expect(await prisma.bookingHistory.count({ where: { bookingId: booking.id, action: status } })).toBe(1);
  });
});

describe('PATCH cancel', () => {
  it('requires a reason', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);

    const res = await patch(instructor, booking.id, 'cancel', {});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cancels with the reason and tells the client why', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor, { status: 'CONFIRMED' });

    const res = await patch(instructor, booking.id, 'cancel', { reason: 'Car in the shop' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({ status: 'CANCELLED', cancelReason: 'Car in the shop' });
    const note = await prisma.notification.findFirst({ where: { userId: client.id } });
    expect(note.message).toContain('Car in the shop');
    expect(await prisma.notification.count({ where: { userId: instructor.id } })).toBe(0);
  });
});

describe('PATCH reschedule', () => {
  const day = () => dayAhead(10);

  it('requires a reason and a future time', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);

    expect((await patch(instructor, booking.id, 'reschedule', { scheduledAt: at(day(), '13:00') })).status).toBe(400);
    expect(
      (await patch(instructor, booking.id, 'reschedule', { scheduledAt: '2001-01-01T00:00:00Z', reason: 'x' })).status,
    ).toBe(400);
  });

  it('refuses times outside working hours, on a day off, or overlapping another session', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);
    await bookFor(client, instructor, { scheduledAt: at(day(), '14:00'), durationMinutes: 90 });
    await prisma.instructorDayOff.create({
      data: { instructorId: instructor.id, date: new Date(`${dayAhead(11)}T00:00:00Z`) },
    });
    const move = (scheduledAt) => patch(instructor, booking.id, 'reschedule', { scheduledAt, reason: 'Traffic' });

    const late = await move(at(day(), '16:30'));
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe('OUTSIDE_AVAILABILITY');

    const early = await move(at(day(), '07:00'));
    expect(early.body.error.code).toBe('OUTSIDE_AVAILABILITY');

    const off = await move(at(dayAhead(11), '10:00'));
    expect(off.status).toBe(400);
    expect(off.body.error.code).toBe('INSTRUCTOR_DAY_OFF');

    const clash = await move(at(day(), '15:00'));
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('SLOT_TAKEN');

    const touching = await move(at(day(), '13:00'));
    expect(touching.status).toBe(200);
  });

  it('records old and new times and tells the client the reason', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);
    const to = at(dayAhead(12), '09:00');

    const res = await patch(instructor, booking.id, 'reschedule', { scheduledAt: to.toISOString(), reason: 'Rain' });

    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('PENDING');
    const [h] = await prisma.bookingHistory.findMany({ where: { bookingId: booking.id } });
    expect(h).toMatchObject({ action: 'RESCHEDULED', reason: 'Rain', changedByRole: 'INSTRUCTOR' });
    expect(h.oldScheduledAt.toISOString()).toBe(booking.scheduledAt.toISOString());
    expect(h.newScheduledAt.toISOString()).toBe(to.toISOString());
    const note = await prisma.notification.findFirst({ where: { userId: client.id } });
    expect(note.type).toBe('BOOKING_RESCHEDULED');
    expect(note.message).toContain('Rain');
  });
});

describe('GET history', () => {
  it('returns the full timeline with actor names', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor);
    await patch(instructor, booking.id, 'confirm').expect(200);
    await patch(instructor, booking.id, 'cancel', { reason: 'Sick' }).expect(200);

    const res = await request(app).get(`${base}/${booking.id}/history`).set(auth(instructor));

    expect(res.status).toBe(200);
    expect(res.body.data.history.map((h) => h.action)).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(res.body.data.history[1]).toMatchObject({
      fromStatus: 'CONFIRMED',
      toStatus: 'CANCELLED',
      reason: 'Sick',
      actorRole: 'INSTRUCTOR',
      actor: { id: instructor.id, fullName: 'Juan Dela Cruz' },
    });
  });
});

describe('POST cash and the cash ledger', () => {
  it('records cash once, notifies, and shows in My Cash', async () => {
    const { instructor, client } = await setup();
    const booking = await bookFor(client, instructor, { status: 'CONFIRMED' });

    const spoofed = await request(app)
      .post(`${base}/${booking.id}/cash`)
      .set(auth(instructor))
      .send({ amount: '1500', recordedBy: client.id });
    expect(spoofed.status).toBe(400);

    const res = await request(app).post(`${base}/${booking.id}/cash`).set(auth(instructor)).send({ amount: '1500' });

    expect(res.status).toBe(201);
    expect(res.body.data.booking.paymentStatus).toBe('PAID');
    const payment = await prisma.payment.findFirst({ where: { bookingId: booking.id } });
    expect(payment).toMatchObject({ method: 'Cash', status: 'PAID', recordedById: instructor.id });
    expect(payment.amount.toString()).toBe('1500');
    expect(await prisma.bookingHistory.count({ where: { action: 'CASH_RECORDED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: instructor.id, type: 'CASH_RECORDED' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'CASH_RECORDED' } })).toBe(1);

    const again = await request(app).post(`${base}/${booking.id}/cash`).set(auth(instructor)).send({ amount: 10 });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_PAID');

    const ledger = await request(app).get('/api/v1/instructor/cash').set(auth(instructor));
    expect(ledger.body.meta.total).toBe(1);
    expect(ledger.body.data[0].receiptNumber).toBe(payment.reference);
    expect(payment.reference).toMatch(/^OR-\d{4}-\d{6}$/);
    expect(ledger.body.data[0]).toMatchObject({ amount: '1500.00', status: 'PAID', voidRequest: null });
  });

  it('refuses cash on pending, cancelled, or bad amounts', async () => {
    const { instructor, client } = await setup();
    const pending = await bookFor(client, instructor);
    const cancelled = await bookFor(client, instructor, { status: 'CANCELLED' });
    const post = (id, body) => request(app).post(`${base}/${id}/cash`).set(auth(instructor)).send(body);

    expect((await post(pending.id, { amount: 100 })).body.error.code).toBe('CASH_NOT_ALLOWED');
    expect((await post(cancelled.id, { amount: 100 })).body.error.code).toBe('CASH_NOT_ALLOWED');
    expect((await post(pending.id, { amount: -5 })).status).toBe(400);
    expect((await post(pending.id, {})).status).toBe(400);
  });

  it('runs the void request flow through to admin approval', async () => {
    const { instructor, client } = await setup();
    const admin = await makeAdmin();
    const booking = await bookFor(client, instructor, { status: 'CONFIRMED' });
    await request(app).post(`${base}/${booking.id}/cash`).set(auth(instructor)).send({ amount: 500 }).expect(201);
    const payment = await prisma.payment.findFirst();
    const ask = () =>
      request(app)
        .post(`/api/v1/instructor/cash/${payment.id}/void-request`)
        .set(auth(instructor))
        .send({ reason: 'Typed the wrong amount' });

    expect((await ask()).status).toBe(201);
    expect((await ask()).body.error.code).toBe('VOID_ALREADY_REQUESTED');

    const otherInstructor = await makeInstructor();
    const foreign = await request(app)
      .post(`/api/v1/instructor/cash/${payment.id}/void-request`)
      .set(auth(otherInstructor))
      .send({ reason: 'x' });
    expect(foreign.status).toBe(404);

    const list = await request(app).get('/api/v1/admin/void-requests?status=PENDING').set(auth(admin));
    expect(list.body.meta.total).toBe(1);
    const id = list.body.data[0].id;

    await request(app).patch(`/api/v1/admin/void-requests/${id}`).set(auth(admin)).send({ decision: 'APPROVE' }).expect(200);
    const twice = await request(app).patch(`/api/v1/admin/void-requests/${id}`).set(auth(admin)).send({ decision: 'REJECT' });
    expect(twice.body.error.code).toBe('VOID_ALREADY_REVIEWED');

    expect((await prisma.payment.findUnique({ where: { id: payment.id } })).status).toBe('VOIDED');
    const ledger = await request(app).get('/api/v1/instructor/cash').set(auth(instructor));
    expect(ledger.body.data[0]).toMatchObject({ status: 'VOIDED', voidRequest: { status: 'APPROVED' } });
  });
});

describe('GET /instructor/dashboard', () => {
  it('summarises today, action counts, the next 7 days, cash today and rating', async () => {
    const { instructor, client } = await setup();
    const soon = new Date(Date.now() + 60000);
    const confirmedToday = await bookFor(client, instructor, { status: 'CONFIRMED', scheduledAt: soon });
    await bookFor(client, instructor, { status: 'CANCELLED', scheduledAt: soon });
    await bookFor(client, instructor, { scheduledAt: at(dayAhead(3), '10:00') });
    await bookFor(client, instructor, { scheduledAt: at(dayAhead(20), '10:00') });
    await bookFor(client, instructor, { status: 'CONFIRMED', scheduledAt: new Date(Date.now() - 50 * HOUR) });

    const first = await request(app).get('/api/v1/instructor/dashboard').set(auth(instructor));
    expect(first.status).toBe(200);
    expect(first.body.data.today.map((b) => b.id)).toEqual([confirmedToday.id]);
    expect(first.body.data.upcoming).toHaveLength(1);
    expect(first.body.data.counts).toEqual({ awaitingConfirmation: 2, cashToCollectToday: 1, needsCompletion: 1 });
    expect(first.body.data.rating).toMatchObject({ count: 0, display: 'New', average: null });

    await request(app).post(`${base}/${confirmedToday.id}/cash`).set(auth(instructor)).send({ amount: 750.5 }).expect(201);
    const after = await request(app).get('/api/v1/instructor/dashboard').set(auth(instructor));
    expect(after.body.data.cashToday).toEqual({ amount: '750.50', count: 1, currency: 'PHP' });
    expect(after.body.data.counts.cashToCollectToday).toBe(0);
    expect(after.body.data.today[0].paymentStatus).toBe('PAID');
  });
});
