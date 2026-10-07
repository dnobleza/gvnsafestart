const request = require('supertest');
const app = require('../../src/app');
const { prisma, resetDb } = require('../helpers');
const { makeInstructor, makeClient, makeBooking, makeBranch, makeAvailability } = require('../admin/factories');
const { haversineKm } = require('../../src/utils/geo');
const { dayAhead, at } = require('../instructor/time');

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

const MAKATI = { latitude: 14.5547, longitude: 121.0244 };
const QC = { latitude: 14.676, longitude: 121.0437 };
const ME_IN_MAKATI = { lat: 14.556, lng: 121.023 };

const rate = (client, instructor, stars) =>
  makeBooking(client, { instructorId: instructor.id, status: 'COMPLETED', scheduledAt: new Date(Date.now() - 86400000) }).then((b) =>
    prisma.rating.create({ data: { bookingId: b.id, clientId: client.id, instructorId: instructor.id, stars } }),
  );

describe('haversineKm', () => {
  it('measures Makati to Quezon City at roughly 13.7 km', () => {
    const km = haversineKm({ lat: MAKATI.latitude, lng: MAKATI.longitude }, { lat: QC.latitude, lng: QC.longitude });
    expect(km).toBeGreaterThan(13);
    expect(km).toBeLessThan(14.5);
  });
});

describe('GET /api/v1/locations', () => {
  it('lists only active branches that have coordinates, without auth', async () => {
    await makeBranch({ name: 'Makati', ...MAKATI });
    await makeBranch({ name: 'No pin' });
    await makeBranch({ name: 'Closed', isActive: false, ...QC });

    const res = await request(app).get('/api/v1/locations');

    expect(res.status).toBe(200);
    expect(res.body.data.locations).toEqual([{ id: expect.any(String), name: 'Makati', latitude: 14.5547, longitude: 121.0244 }]);
  });
});

describe('GET /api/v1/instructors', () => {
  it('browses and filters bookable instructors and never leaks the home address', async () => {
    const makati = await makeBranch({ name: 'Makati', ...MAKATI });
    const qc = await makeBranch({ name: 'QC', ...QC });
    await makeInstructor({ branch: makati, fullName: 'Juan Dela Cruz' });
    await makeInstructor({ branch: qc, fullName: 'Rita Reyes' });
    await makeInstructor({ branch: qc, fullName: 'Inactive Ian', isActive: false });

    const all = await request(app).get('/api/v1/instructors');
    expect(all.body.data.map((i) => i.fullName)).toEqual(['Juan Dela Cruz', 'Rita Reyes']);
    expect(JSON.stringify(all.body)).not.toMatch(/1 Test St|Brgy Test|street|barangay/);
    expect(all.body.data[0]).toEqual({
      id: expect.any(String),
      fullName: 'Juan Dela Cruz',
      branch: { id: makati.id, name: 'Makati' },
      rating: expect.objectContaining({ display: 'New', count: 0 }),
    });

    expect((await request(app).get(`/api/v1/instructors?locationId=${qc.id}`)).body.meta.total).toBe(1);
    expect((await request(app).get('/api/v1/instructors?search=rita')).body.data[0].fullName).toBe('Rita Reyes');
    expect((await request(app).get('/api/v1/instructors?page=2&limit=1')).body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/instructors/:id/slots', () => {
  it('returns only open slots and 404s for unknown or inactive instructors', async () => {
    const instructor = await makeInstructor();
    const client = await makeClient();
    await makeAvailability(instructor, { startTime: '08:00', endTime: '11:00' });
    const day = dayAhead(9);
    await makeBooking(client, { instructorId: instructor.id, scheduledAt: at(day, '09:00') });

    const res = await request(app).get(`/api/v1/instructors/${instructor.id}/slots?date=${day}&duration=60`);
    expect(res.body.data.slots.map((s) => s.time)).toEqual(['08:00', '10:00']);

    const inactive = await makeInstructor({ isActive: false });
    expect((await request(app).get(`/api/v1/instructors/${inactive.id}/slots?date=${day}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/instructors/${instructor.id}/slots?date=nope`)).status).toBe(400);
  });
});

describe('GET /api/v1/instructors/recommended', () => {
  it('ranks by branch distance, then availability on the date, then rating', async () => {
    const makati = await makeBranch({ name: 'Makati', ...MAKATI });
    const qc = await makeBranch({ name: 'QC', ...QC });
    const unpinned = await makeBranch({ name: 'Unpinned' });
    const client = await makeClient();
    const day = dayAhead(10);

    const nearBusy = await makeInstructor({ branch: makati, fullName: 'Near Busy' });
    const nearFreeLow = await makeInstructor({ branch: makati, fullName: 'Near Free Low' });
    const nearFreeHigh = await makeInstructor({ branch: makati, fullName: 'Near Free High' });
    const far = await makeInstructor({ branch: qc, fullName: 'Far Away' });
    const nowhere = await makeInstructor({ branch: unpinned, fullName: 'No Distance' });
    for (const i of [nearFreeLow, nearFreeHigh, far, nowhere]) await makeAvailability(i);
    await makeAvailability(nearBusy, { days: [new Date(`${dayAhead(11)}T00:00:00Z`).getUTCDay()] });
    for (let n = 0; n < 3; n += 1) await rate(client, nearFreeLow, 3);
    for (let n = 0; n < 3; n += 1) await rate(client, nearFreeHigh, 5);

    const res = await request(app).get(
      `/api/v1/instructors/recommended?lat=${ME_IN_MAKATI.lat}&lng=${ME_IN_MAKATI.lng}&date=${day}`,
    );

    expect(res.status).toBe(200);
    const list = res.body.data.instructors;
    expect(list.map((i) => i.fullName)).toEqual(['Near Free High', 'Near Free Low', 'Near Busy', 'Far Away', 'No Distance']);
    expect(list[0]).toMatchObject({
      branch: { name: 'Makati' },
      distanceKm: expect.any(Number),
      availableOnDate: true,
      rating: { display: '5.0', count: 3 },
      nextAvailableSlot: { date: day, time: '08:00', start: expect.any(String) },
    });
    expect(list[2]).toMatchObject({ availableOnDate: false, nextAvailableSlot: { date: dayAhead(11) } });
    expect(list[3].distanceKm).toBeGreaterThan(12);
    expect(list[4].distanceKm).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/street|barangay|1 Test St/);
  });

  it('requires coordinates and a date', async () => {
    expect((await request(app).get('/api/v1/instructors/recommended?lat=14&lng=121')).status).toBe(400);
    expect((await request(app).get(`/api/v1/instructors/recommended?lat=200&lng=121&date=${dayAhead(1)}`)).status).toBe(400);
  });
});
