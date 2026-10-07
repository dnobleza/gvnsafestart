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
  makeCatalog,
  auth,
} = require('../admin/factories');
const { dayAhead, at } = require('../instructor/time');

const DAY = 86400000;
const HOUR = 3600000;

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const rate = (user, bookingId, body) =>
  request(app).post(`/api/v1/client/bookings/${bookingId}/rating`).set(auth(user)).send(body);

const completed = (client, instructor, daysAgo = 1, extra = {}) =>
  makeBooking(client, {
    instructorId: instructor.id,
    status: 'COMPLETED',
    scheduledAt: new Date(Date.now() - daysAgo * DAY),
    ...extra,
  });

const addRatings = async (instructor, starsList, comments = []) => {
  for (const [i, stars] of starsList.entries()) {
    const client = await makeClient();
    const booking = await completed(client, instructor);
    await prisma.rating.create({
      data: {
        bookingId: booking.id,
        clientId: client.id,
        instructorId: instructor.id,
        stars,
        comment: comments[i] ?? null,
        createdAt: new Date(Date.now() - (starsList.length - i) * 60000),
      },
    });
  }
};

describe('client rates a package session end to end', () => {
  it('rates once the instructor marks the started session completed', async () => {
    const ctx = await makeCatalog();
    const instructor = await makeInstructor({ fullName: 'Juan Dela Cruz' });
    const client = await makeClient();
    await makeAvailability(instructor, { startTime: '06:00', endTime: '20:00' });
    const bought = await request(app)
      .post('/api/v1/client/packages')
      .set(auth(client))
      .send({
        packageId: ctx.option2.id,
        serviceAreaId: ctx.area.id,
        trainingType: 'OWN_CAR',
        instructorId: instructor.id,
        scheduledAt: at(dayAhead(3), '08:00'),
        pickupAddress: '12 Mabini St, Makati',
        paymentMethod: 'CASH',
      })
      .expect(201);
    const session = await prisma.booking.findFirst({ where: { clientPackageId: bought.body.data.package.id } });
    await request(app).patch(`/api/v1/instructor/bookings/${session.id}/confirm`).set(auth(instructor)).expect(200);

    const early = await rate(client, session.id, { stars: 5 });
    expect(early.status).toBe(400);
    expect(early.body.error.message).toBe('You can rate after your session is completed');
    const view = await request(app).get(`/api/v1/client/bookings/${session.id}`).set(auth(client));
    expect(view.body.data.booking).toMatchObject({ ratingState: 'NOT_YET', canRate: false });

    // What the dev helper does: the session has started, so it can be completed.
    await prisma.booking.update({ where: { id: session.id }, data: { scheduledAt: new Date(Date.now() - 2 * HOUR) } });
    await request(app).patch(`/api/v1/instructor/bookings/${session.id}/complete`).set(auth(instructor)).expect(200);

    const open = await request(app).get(`/api/v1/client/bookings/${session.id}`).set(auth(client));
    expect(open.body.data.booking).toMatchObject({ ratingState: 'OPEN', canRate: true });

    const res = await rate(client, session.id, { stars: 5, comment: 'Very patient' });
    expect(res.status).toBe(201);
    expect(await prisma.notification.count({ where: { userId: instructor.id, type: 'RATING_RECEIVED' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'RATING_CREATED', actorId: client.id } })).toBe(1);

    const again = await rate(client, session.id, { stars: 4 });
    expect(again.status).toBe(409);
    expect(again.body.error.message).toBe('You already rated this session');
    const after = await request(app).get(`/api/v1/client/bookings/${session.id}`).set(auth(client));
    expect(after.body.data.booking).toMatchObject({ ratingState: 'RATED', rating: { stars: 5 } });
  });

  it('rejects other clients, an expired window, bad stars and long comments', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    const stranger = await makeClient();
    const done = await completed(client, instructor);
    const old = await completed(client, instructor, 15);

    expect((await rate(stranger, done.id, { stars: 5 })).status).toBe(404);
    const expired = await rate(client, old.id, { stars: 5 });
    expect(expired.body.error.message).toBe('The rating period has ended');
    expect((await request(app).get(`/api/v1/client/bookings/${old.id}`).set(auth(client))).body.data.booking.ratingState).toBe('EXPIRED');
    for (const body of [{ stars: 0 }, { stars: 6 }, { stars: 4.5 }, {}, { stars: 5, comment: 'x'.repeat(501) }]) {
      expect((await rate(client, done.id, body)).status).toBe(400);
    }
    await expect(
      prisma.rating.create({ data: { bookingId: done.id, clientId: client.id, instructorId: instructor.id, stars: 6 } }),
    ).rejects.toThrow();
  });
});

describe('instructor sees only their own ratings', () => {
  it('scopes to the session user, hides hidden comments but counts them, and never names clients', async () => {
    const a = await makeInstructor({ fullName: 'Instructor A' });
    const b = await makeInstructor({ fullName: 'Instructor B' });
    const admin = await makeAdmin();
    await addRatings(a, [5, 4], ['Great teacher', 'Hidden one']);
    await addRatings(b, [1], ['Not for A']);
    const hidden = await prisma.rating.findFirst({ where: { comment: 'Hidden one' } });
    await request(app).patch(`/api/v1/admin/ratings/${hidden.id}/hide`).set(auth(admin)).send({ hidden: true }).expect(200);

    const res = await request(app).get('/api/v1/instructor/ratings').set(auth(a));

    expect(res.body.data.summary).toMatchObject({ average: 4.5, count: 2, display: 'New' });
    expect(res.body.data.summary.breakdown[0]).toEqual({ stars: 5, count: 1 });
    expect(res.body.data.ratings).toEqual([
      { id: expect.any(String), stars: 5, comment: 'Great teacher', sessionDate: expect.any(String), createdAt: expect.any(String) },
    ]);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/Not for A|Hidden one|Client User|client\d+@/);

    expect((await request(app).get(`/api/v1/instructor/ratings?instructorId=${b.id}`).set(auth(a))).status).toBe(400);
    expect((await request(app).get(`/api/v1/instructor/ratings/${b.id}`).set(auth(a))).status).toBe(404);

    const adminView = await request(app).get('/api/v1/admin/ratings').set(auth(admin));
    expect(adminView.body.data.ratings.every((r) => r.client && r.client.fullName)).toBe(true);
    expect(adminView.body.meta.total).toBe(3);
  });
});

describe('GET /public/top-instructors', () => {
  it('ranks active instructors with 3+ ratings by average then count, top 5, without private data', async () => {
    const branch = await makeBranch({ name: 'Makati' });
    const make = (fullName, extra = {}) => makeInstructor({ fullName, branch, phone: null, ...extra });
    const best = await make('Ana Best');
    const tieMore = await make('Ben Tie');
    const tieLess = await make('Cara Tie');
    const two = await make('Dan Two');
    const off = await make('Eve Inactive', { isActive: false });
    const others = [];
    for (const name of ['F', 'G', 'H', 'I']) others.push(await make(`${name} Other`));

    await addRatings(best, [5, 5, 5], ['First', 'Second', `Newest ${'y'.repeat(200)}`]);
    await addRatings(tieMore, [4, 4, 4, 4]);
    await addRatings(tieLess, [4, 4, 4]);
    await addRatings(two, [5, 5]);
    await addRatings(off, [5, 5, 5]);
    for (const o of others) await addRatings(o, [3, 3, 3]);

    const res = await request(app).get('/api/v1/public/top-instructors');

    expect(res.status).toBe(200);
    const list = res.body.data.instructors;
    expect(list).toHaveLength(5);
    expect(list.slice(0, 3).map((i) => i.fullName)).toEqual(['Ana Best', 'Ben Tie', 'Cara Tie']);
    expect(list.map((i) => i.fullName)).not.toContain('Dan Two');
    expect(list.map((i) => i.fullName)).not.toContain('Eve Inactive');
    expect(list[0]).toEqual({
      id: best.id,
      fullName: 'Ana Best',
      branch: { name: 'Makati' },
      average: 5,
      count: 3,
      comment: expect.stringMatching(/^Newest y+…$/),
    });
    expect(list[0].comment.length).toBe(120);
    expect(list[1].comment).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/@test\.local|street|barangay|phone|Client User/);
  });

  it('caches for 10 minutes but refreshes when a comment is hidden', async () => {
    const instructor = await makeInstructor({ fullName: 'Ana Best' });
    const admin = await makeAdmin();
    await addRatings(instructor, [5, 5, 5], ['a', 'b', 'Latest']);

    const first = await request(app).get('/api/v1/public/top-instructors');
    expect(first.body.data.instructors[0].comment).toBe('Latest');

    await prisma.rating.updateMany({ where: { comment: 'Latest' }, data: { comment: 'Changed directly' } });
    expect((await request(app).get('/api/v1/public/top-instructors')).body.data.instructors[0].comment).toBe('Latest');

    const latest = await prisma.rating.findFirst({ where: { comment: 'Changed directly' } });
    await request(app).patch(`/api/v1/admin/ratings/${latest.id}/hide`).set(auth(admin)).send({ hidden: true }).expect(200);
    expect((await request(app).get('/api/v1/public/top-instructors')).body.data.instructors[0].comment).toBe('b');
  });

  it('returns an empty list when nobody qualifies, and the public card for one instructor', async () => {
    const instructor = await makeInstructor({ fullName: 'Solo' });
    expect((await request(app).get('/api/v1/public/top-instructors')).body.data.instructors).toEqual([]);

    const card = await request(app).get(`/api/v1/instructors/${instructor.id}`);
    expect(card.body.data.instructor).toMatchObject({ id: instructor.id, fullName: 'Solo', rating: { display: 'New' } });
    expect(JSON.stringify(card.body)).not.toMatch(/@test\.local|street/);
    const inactive = await makeInstructor({ isActive: false });
    expect((await request(app).get(`/api/v1/instructors/${inactive.id}`)).status).toBe(404);
  });
});
