const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDb } = require('./helpers');
const { makeAdmin, makeInstructor, makeClient, makeBooking, auth } = require('./admin/factories');
const autoComplete = require('../src/services/autoComplete.service');

const HOUR = 3600000;
const ago = (hours) => new Date(Date.now() - hours * HOUR);

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const setup = async () => {
  const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
  const client = await makeClient({ fullName: 'Ana Reyes' });
  const booking = (overrides) =>
    makeBooking(client, { instructorId: instructor.id, status: 'CONFIRMED', durationMinutes: 60, ...overrides });
  return { instructor, client, booking };
};

const statusOf = async (id) => (await prisma.booking.findUnique({ where: { id } })).status;

describe('runAutoComplete', () => {
  it('completes confirmed sessions past end + grace as System and leaves those inside the grace period', async () => {
    const { instructor, client, booking } = await setup();
    const due = await booking({ scheduledAt: ago(4), paymentMethod: 'ONLINE', paymentStatus: 'PAID' });
    const inGrace = await booking({ scheduledAt: ago(2) });

    const result = await autoComplete.runAutoComplete();

    expect(result).toMatchObject({ status: 'SUCCESS', completed: 1, cancelled: 0, cashUnpaid: 0 });
    const stored = await prisma.booking.findUnique({ where: { id: due.id } });
    expect(stored).toMatchObject({ status: 'COMPLETED', autoCompleted: true, lastActionById: null });
    expect(stored.autoCompletedAt).toBeInstanceOf(Date);
    expect(await statusOf(inGrace.id)).toBe('CONFIRMED');

    const history = await prisma.bookingHistory.findMany({ where: { bookingId: due.id } });
    expect(history).toEqual([
      expect.objectContaining({
        action: 'COMPLETED',
        fromStatus: 'CONFIRMED',
        toStatus: 'COMPLETED',
        changedById: null,
        changedByRole: 'SYSTEM',
        reason: 'Auto-completed after session end',
      }),
    ]);
    const toClient = await prisma.notification.findFirst({ where: { userId: client.id, type: 'BOOKING_COMPLETED' } });
    expect(toClient.message).toBe('How was your session? Rate your instructor.');
    const toInstructor = await prisma.notification.findFirst({ where: { userId: instructor.id, type: 'BOOKING_COMPLETED' } });
    expect(toInstructor.message).toBe('Session with Ana Reyes was marked completed.');

    const run = await prisma.cronRun.findFirst();
    expect(run).toMatchObject({ job: 'auto-complete', status: 'SUCCESS', completedCount: 1, cancelledCount: 0 });
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('uses the admin grace setting', async () => {
    const { booking } = await setup();
    const due = await booking({ scheduledAt: ago(4) });
    await prisma.appSetting.create({ data: { key: 'autoCompleteGraceHours', value: 5 } });

    await autoComplete.runAutoComplete();

    expect(await statusOf(due.id)).toBe('CONFIRMED');
  });

  it('completes unpaid cash sessions but flags them and tells the instructor', async () => {
    const { instructor, booking } = await setup();
    const cash = await booking({ scheduledAt: ago(5), paymentMethod: 'CASH', paymentStatus: 'AWAITING_CASH' });

    const result = await autoComplete.runAutoComplete();

    expect(result).toMatchObject({ completed: 1, cashUnpaid: 1 });
    expect(await statusOf(cash.id)).toBe('COMPLETED');
    const flag = await prisma.notification.findFirst({ where: { userId: instructor.id, type: 'CASH_NOT_RECORDED' } });
    expect(flag.message).toBe("Cash not recorded for Ana Reyes's session.");
    expect((await prisma.cronRun.findFirst()).cashUnpaidCount).toBe(1);
  });

  it('cancels pending sessions past their start and notifies both sides', async () => {
    const { instructor, client, booking } = await setup();
    const pending = await booking({ status: 'PENDING', scheduledAt: ago(0.5) });
    const future = await booking({ status: 'PENDING', scheduledAt: new Date(Date.now() + 5 * HOUR) });

    const result = await autoComplete.runAutoComplete();

    expect(result).toMatchObject({ completed: 0, cancelled: 1 });
    const stored = await prisma.booking.findUnique({ where: { id: pending.id } });
    expect(stored).toMatchObject({ status: 'CANCELLED', cancelReason: 'Not confirmed before session start' });
    expect(await statusOf(future.id)).toBe('PENDING');
    expect(await prisma.notification.count({ where: { userId: client.id, type: 'BOOKING_CANCELLED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: instructor.id, type: 'BOOKING_CANCELLED' } })).toBe(1);
  });

  it('never touches no-show, cancelled or completed sessions', async () => {
    const { booking } = await setup();
    const rows = await Promise.all(
      ['NO_SHOW', 'CANCELLED', 'COMPLETED'].map((status) => booking({ status, scheduledAt: ago(10) })),
    );

    const result = await autoComplete.runAutoComplete();

    expect(result).toMatchObject({ completed: 0, cancelled: 0 });
    expect(await Promise.all(rows.map((r) => statusOf(r.id)))).toEqual(['NO_SHOW', 'CANCELLED', 'COMPLETED']);
    expect(await prisma.bookingHistory.count()).toBe(0);
  });

  it('is idempotent: a second run changes nothing', async () => {
    const { booking } = await setup();
    await booking({ scheduledAt: ago(4) });
    await booking({ status: 'PENDING', scheduledAt: ago(1) });

    await autoComplete.runAutoComplete();
    const counts = async () => [await prisma.bookingHistory.count(), await prisma.notification.count()];
    const before = await counts();
    const second = await autoComplete.runAutoComplete();

    expect(second).toMatchObject({ status: 'SUCCESS', completed: 0, cancelled: 0 });
    expect(await counts()).toEqual(before);
  });

  it('concurrent runs process each booking once', async () => {
    const { booking } = await setup();
    await Promise.all([1, 2, 3].map((n) => booking({ scheduledAt: ago(4 + n) })));

    const results = await Promise.all([autoComplete.runAutoComplete(), autoComplete.runAutoComplete()]);

    expect(results.reduce((sum, r) => sum + r.completed, 0)).toBe(3);
    expect(await prisma.bookingHistory.count({ where: { action: 'COMPLETED' } })).toBe(3);
    expect(results.map((r) => r.status).sort()).toEqual(expect.arrayContaining(['SUCCESS']));
  });

  it('a held advisory lock makes the run skip', async () => {
    const { booking } = await setup();
    const due = await booking({ scheduledAt: ago(4) });
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4217001::bigint)`;
        await held;
      },
      { timeout: 20000 },
    );
    await new Promise((r) => setTimeout(r, 200));

    const result = await autoComplete.runAutoComplete();
    release();
    await holder;

    expect(result.status).toBe('SKIPPED');
    expect(await statusOf(due.id)).toBe('CONFIRMED');
    expect((await prisma.cronRun.findFirst()).status).toBe('SKIPPED');
  });
});

describe('triggers', () => {
  it('external endpoint requires the cron secret', async () => {
    const call = (header) => {
      const req = request(app).post('/api/v1/cron/auto-complete');
      return header ? req.set('Authorization', header) : req;
    };

    expect((await call()).status).toBe(401);
    expect((await call('Bearer wrong-secret-value-xx')).status).toBe(401);
    const ok = await call('Bearer cron-test-secret-value');
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('SUCCESS');
    expect((await prisma.cronRun.findFirst()).trigger).toBe('EXTERNAL');
  });

  it('"Run now" is admin-only, audited, and listed in run history', async () => {
    const { instructor, client, booking } = await setup();
    await booking({ scheduledAt: ago(4) });
    const admin = await makeAdmin();

    expect((await request(app).post('/api/v1/admin/auto-complete/run').set(auth(instructor))).status).toBe(403);
    expect((await request(app).post('/api/v1/admin/auto-complete/run').set(auth(client))).status).toBe(403);

    const res = await request(app).post('/api/v1/admin/auto-complete/run').set(auth(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'SUCCESS', completed: 1 });
    expect(await prisma.auditLog.count({ where: { action: 'AUTO_COMPLETE_RUN' } })).toBe(1);

    const status = await request(app).get('/api/v1/admin/auto-complete').set(auth(admin));
    expect(status.body.data).toMatchObject({ enabled: false, graceHours: 2, nextRunAt: null });
    expect(status.body.data.lastRun).toMatchObject({ trigger: 'ADMIN', completed: 1 });
    const runs = await request(app).get('/api/v1/admin/auto-complete/runs?page=1&limit=10').set(auth(admin));
    expect(runs.body.meta.total).toBe(1);
  });

  it('dashboards settle only the viewing user\'s bookings first', async () => {
    const { client, booking } = await setup();
    const mine = await booking({ scheduledAt: ago(4) });
    const otherClient = await makeClient();
    const theirs = await makeBooking(otherClient, { instructorId: null, status: 'CONFIRMED', scheduledAt: ago(4) });

    const res = await request(app).get('/api/v1/client/dashboard').set(auth(client));

    expect(res.status).toBe(200);
    expect(await statusOf(mine.id)).toBe('COMPLETED');
    expect(await statusOf(theirs.id)).toBe('CONFIRMED');
    expect(res.body.data.toRate.map((b) => b.id)).toEqual([mine.id]);
    expect(await prisma.cronRun.count()).toBe(0);
  });

  it('admin can filter bookings by who completed them and list completed cash still unpaid', async () => {
    const { booking } = await setup();
    const auto = await booking({ scheduledAt: ago(4), paymentMethod: 'CASH', paymentStatus: 'AWAITING_CASH' });
    await booking({ status: 'COMPLETED', scheduledAt: ago(30), paymentMethod: 'CASH', paymentStatus: 'PAID' });
    await autoComplete.runAutoComplete();
    const admin = await makeAdmin();

    const bySystem = await request(app).get('/api/v1/admin/bookings?completedBy=SYSTEM').set(auth(admin));
    expect(bySystem.body.data.map((b) => b.id)).toEqual([auto.id]);
    expect(bySystem.body.data[0]).toMatchObject({ autoCompleted: true, cashUnpaid: true });
    const unpaid = await request(app).get('/api/v1/admin/bookings?cashUnpaid=true').set(auth(admin));
    expect(unpaid.body.meta.total).toBe(1);
  });
});

describe('PATCH /instructor/bookings/:id/correct-no-show', () => {
  const correct = (instructor, id, body = { reason: 'Client never arrived' }) =>
    request(app).patch(`/api/v1/instructor/bookings/${id}/correct-no-show`).set(auth(instructor)).send(body);

  it('turns a system-completed session into a no-show, excludes the rating, and tells admins', async () => {
    const { instructor, client, booking } = await setup();
    const admin = await makeAdmin();
    const due = await booking({ scheduledAt: ago(4) });
    await autoComplete.runAutoComplete();
    const rating = await prisma.rating.create({
      data: { bookingId: due.id, clientId: client.id, instructorId: instructor.id, stars: 1 },
    });

    expect((await correct(instructor, due.id, {})).status).toBe(400);
    const res = await correct(instructor, due.id);

    expect(res.status).toBe(200);
    expect(res.body.data.booking).toMatchObject({ status: 'NO_SHOW', canCorrectNoShow: false });
    expect(await prisma.rating.findUnique({ where: { id: rating.id } })).toMatchObject({ isHidden: true });
    expect((await prisma.rating.findUnique({ where: { id: rating.id } })).excludedAt).toBeInstanceOf(Date);
    const history = await prisma.bookingHistory.findFirst({ where: { bookingId: due.id, action: 'NO_SHOW' } });
    expect(history).toMatchObject({ fromStatus: 'COMPLETED', toStatus: 'NO_SHOW', changedById: instructor.id, reason: 'Client never arrived' });
    expect(await prisma.auditLog.count({ where: { action: 'BOOKING_NO_SHOW_CORRECTED' } })).toBe(1);
    const note = await prisma.notification.findFirst({ where: { userId: admin.id, type: 'BOOKING_CORRECTED' } });
    expect(note.bookingId).toBe(due.id);

    const ratings = await request(app).get('/api/v1/instructor/ratings').set(auth(instructor));
    expect(ratings.body.data.summary.count).toBe(0);
  });

  it('rejects instructor-completed sessions, other instructors, and corrections after 24 hours', async () => {
    const { instructor, booking } = await setup();
    const other = await makeInstructor();
    const manual = await booking({ status: 'COMPLETED', scheduledAt: ago(5) });
    const stale = await booking({ status: 'COMPLETED', scheduledAt: ago(30), autoCompleted: true, autoCompletedAt: ago(25) });
    const fresh = await booking({ status: 'COMPLETED', scheduledAt: ago(5), autoCompleted: true, autoCompletedAt: ago(1) });

    expect((await correct(instructor, manual.id)).body.error.code).toBe('CORRECTION_NOT_ALLOWED');
    const late = await correct(instructor, stale.id);
    expect(late.status).toBe(400);
    expect(late.body.error.code).toBe('CORRECTION_WINDOW_CLOSED');
    expect((await correct(other, fresh.id)).status).toBe(404);
    expect(await statusOf(stale.id)).toBe('COMPLETED');

    const detail = await request(app).get(`/api/v1/instructor/bookings/${fresh.id}`).set(auth(instructor));
    expect(detail.body.data.booking).toMatchObject({ autoCompleted: true, canCorrectNoShow: true });
    const closed = await request(app).get(`/api/v1/instructor/bookings/${stale.id}`).set(auth(instructor));
    expect(closed.body.data.booking.canCorrectNoShow).toBe(false);
  });
});
