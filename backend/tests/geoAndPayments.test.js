const request = require('supertest');
const app = require('../src/app');
const { prisma, resetDb } = require('./helpers');
const { makeAdmin, makeClient, auth } = require('./admin/factories');
const geocoder = require('../src/services/geocoder.service');

beforeEach(async () => {
  await resetDb();
  geocoder.clearCache();
});
afterEach(() => jest.restoreAllMocks());
afterAll(() => prisma.$disconnect());

const NOMINATIM = {
  address: {
    house_number: '12',
    road: 'Mabini Street',
    quarter: 'Poblacion',
    city: 'Makati',
    region: 'Metro Manila',
  },
};

const ok = (body) => ({ ok: true, status: 200, json: async () => body });

describe('GET /geo/reverse', () => {
  it('turns coordinates into a barangay and city, and caches the answer', async () => {
    const client = await makeClient();
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(ok(NOMINATIM));

    const res = await request(app).get('/api/v1/geo/reverse?lat=14.5649&lng=121.0310').set(auth(client));

    expect(res.status).toBe(200);
    expect(res.body.data.place).toEqual({
      label: 'Poblacion, Makati',
      barangay: 'Poblacion',
      city: 'Makati',
      province: 'Metro Manila',
      address: '12 Mabini Street, Poblacion, Makati, Metro Manila',
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/geo\.example\.test\/reverse\?format=jsonv2&lat=14\.5649&lon=121\.031/);
    expect(init.headers['User-Agent']).toBe('GVN-Safestart/1.0 (ops@example.test)');

    await request(app).get('/api/v1/geo/reverse?lat=14.56491&lng=121.03101').set(auth(client)).expect(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null place when the lookup fails, and validates input and auth', async () => {
    const client = await makeClient();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    const res = await request(app).get('/api/v1/geo/reverse?lat=10&lng=120').set(auth(client));
    expect(res.status).toBe(200);
    expect(res.body.data.place).toBeNull();

    expect((await request(app).get('/api/v1/geo/reverse?lat=10&lng=120')).status).toBe(401);
    expect((await request(app).get('/api/v1/geo/reverse?lat=95&lng=120').set(auth(client))).status).toBe(400);
  });

  it('maps village/town style addresses too', () => {
    expect(geocoder.toPlace({ address: { village: 'San Isidro', town: 'Cainta', province: 'Rizal' } })).toMatchObject({
      label: 'San Isidro, Cainta',
      address: 'San Isidro, Cainta, Rizal',
    });
    expect(geocoder.toPlace({ address: {} })).toBeNull();
  });
});

describe('admin payment provider status', () => {
  const hooks = (attrs) => ok({ data: attrs.map((a) => ({ id: 'hook', attributes: a })) });
  const WEBHOOK = 'https://api.example.test/api/v1/payments/webhooks/paymongo';

  it('shows mode and webhook URL without exposing keys', async () => {
    const admin = await makeAdmin();

    const res = await request(app).get('/api/v1/admin/payment-provider').set(auth(admin));

    expect(res.body.data).toEqual({
      provider: 'paymongo',
      mode: 'test',
      secretKeySet: true,
      webhookSecretSet: true,
      webhookUrl: WEBHOOK,
      webhookEvent: 'checkout_session.payment.paid',
      webhookUrlIsLocal: false,
      returnUrl: 'http://localhost:5173',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/sk_test_unit|whsk_test/);
    expect((await request(app).get('/api/v1/admin/payment-provider').set(auth(await makeClient()))).status).toBe(403);
  });

  it('tests the connection: matching webhook, missing webhook, bad key', async () => {
    const admin = await makeAdmin();
    const test = () => request(app).post('/api/v1/admin/payment-provider/test').set(auth(admin));
    const spy = jest.spyOn(global, 'fetch');

    spy.mockResolvedValueOnce(hooks([{ url: WEBHOOK, status: 'enabled', events: ['checkout_session.payment.paid'] }]));
    const good = await test();
    expect(good.body.data.result).toMatchObject({ ok: true, keyValid: true, webhookFound: true });
    expect(String(spy.mock.calls[0][0])).toBe('https://paymongo.test/v1/webhooks');

    spy.mockResolvedValueOnce(hooks([{ url: 'https://old.example/hook', status: 'enabled', events: [] }]));
    const missing = await test();
    expect(missing.body.data.result).toMatchObject({ ok: false, keyValid: true, webhookFound: false });
    expect(missing.body.data.result.message).toContain(WEBHOOK);

    spy.mockResolvedValueOnce(hooks([{ url: WEBHOOK, status: 'disabled', events: ['checkout_session.payment.paid'] }]));
    expect((await test()).body.data.result.message).toMatch(/disabled/);

    spy.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    expect((await test()).body.data.result).toMatchObject({ ok: false, keyValid: false });

    expect(await prisma.auditLog.count({ where: { action: 'PAYMENT_PROVIDER_TESTED' } })).toBe(4);
    const logs = await prisma.auditLog.findMany({ where: { action: 'PAYMENT_PROVIDER_TESTED' } });
    expect(JSON.stringify(logs)).not.toMatch(/sk_test_unit|whsk_test/);
  });
});
