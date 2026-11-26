import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
vi.mock('../src/clients/mapbox.client.js', () => ({ drivingDistanceKm: vi.fn(async () => 7.2), reverseGeocode: vi.fn(), forwardGeocode: vi.fn() }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());

const mapbox = await import('../src/clients/mapbox.client.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog } = await import('../src/models/index.js');
const { SETTING_DEFAULTS } = await import('../src/constants/settings.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let kaluppa;
let buyer;
let kaluppaId;
const HOURS = [...Array(6).fill({ open: true, from: '08:00', to: '17:00' }), { open: false, from: '08:00', to: '17:00' }];
const branch = (fields = {}) => ({
  name: 'Kaluppa',
  phone: '0917 800 1122',
  street: 'Km 3',
  barangay: 'Pantayin',
  municipality: 'Santa Cruz',
  location: { lat: 13.4701, lng: 122.0402 },
  hours: HOURS,
  ...fields,
});
const qr = (n) => ({ url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/wallet-qr/${kaluppaId}/q${n}.png`, publicId: `kapekonek/wallet-qr/${kaluppaId}/q${n}` });

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  kaluppa = await signedIn('kapekonek.kaluppa@gmail.com');
  buyer = await signedIn('kapekonek.buyer@gmail.com');
  kaluppaId = (await kaluppa.get('/api/auth/me')).body.data.user.id;
});
afterAll(stopMemoryDb);
beforeEach(() => mapbox.drivingDistanceKm.mockClear());

describe('Branch', () => {
  it('reads the defaults, then saves a new pin that the next quote starts from', async () => {
    expect((await kaluppa.get('/api/admin/settings/branch')).body.data).toMatchObject({ name: 'Kaluppa', barangay: 'Pantayin', location: SETTING_DEFAULTS.branch.location });
    await buyer.get('/api/delivery/quote?lat=13.41&lng=122.01').expect(200);
    expect(mapbox.drivingDistanceKm.mock.calls[0][0]).toEqual(SETTING_DEFAULTS.branch.location);

    const res = await kaluppa.patch('/api/admin/settings/branch').send(branch());
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ street: 'Km 3', phone: '09178001122', location: { lat: 13.4701, lng: 122.0402 } });

    await buyer.get('/api/delivery/quote?lat=13.41&lng=122.01').expect(200);
    expect(mapbox.drivingDistanceKm.mock.calls.at(-1)[0]).toEqual({ lat: 13.4701, lng: 122.0402 });
    const info = (await request(app).get('/api/delivery/info')).body.data;
    // Saved as 09178001122, shown spaced like the default (pickup card, bean instructions).
    expect(info.pickup).toMatchObject({ address: 'Km 3, Pantayin, Santa Cruz, Marinduque', hours: 'Mon–Sat, 8:00 AM – 5:00 PM', phone: '0917 800 1122' });
  });

  it('checks the hours (closing after opening), the barangay and the pin', async () => {
    const hours = HOURS.map((h, i) => (i === 2 ? { open: true, from: '17:00', to: '08:00' } : h));
    const res = await kaluppa.patch('/api/admin/settings/branch').send(branch({ hours, barangay: 'Nowhere', location: { lat: 14.6, lng: 121 } }));
    expect(res.status).toBe(400);
    expect(res.body.errors).toMatchObject({ 'hours.2.to': 'Closing time must be after opening time', barangay: expect.any(String), location: expect.any(String) });
    // A closed day may keep any times.
    const closed = HOURS.map((h, i) => (i === 6 ? { open: false, from: '17:00', to: '08:00' } : h));
    expect((await kaluppa.patch('/api/admin/settings/branch').send(branch({ hours: closed }))).status).toBe(200);
  });
});

describe('Delivery fee', () => {
  it('saves the fee rules and ETA; the next quote uses them', async () => {
    const res = await kaluppa.patch('/api/admin/settings/delivery').send({ baseFeeCentavos: 6000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60, minBusinessDays: 2, maxBusinessDays: 4 });
    expect(res.status).toBe(200);
    expect((await kaluppa.get('/api/admin/settings/delivery')).body.data).toMatchObject({ baseFeeCentavos: 6000, minBusinessDays: 2, maxBusinessDays: 4 });
    const quote = (await buyer.get('/api/delivery/quote?lat=13.42&lng=122.02')).body.data;
    expect(quote.feeCentavos).toBe(10500); // ₱60 + ₱10 × 4.2 km = ₱102 → ₱105
  });

  it('refuses an ETA that ends before it starts', async () => {
    const res = await kaluppa.patch('/api/admin/settings/delivery').send({ baseFeeCentavos: 5000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60, minBusinessDays: 5, maxBusinessDays: 3 });
    expect(res.body.errors.maxBusinessDays).toEqual(expect.any(String));
  });
});

describe('E-wallet', () => {
  it('saves both accounts with their QR; checkout only offers the ones shown', async () => {
    expect((await kaluppa.get('/api/admin/settings/ewallet')).body.data.accounts.map((a) => a.provider)).toEqual(['GCash', 'Maya']);
    const accounts = [
      { provider: 'GCash', accountName: 'Kaluppa Coffee', accountNumber: '0917 555 0101', showAtCheckout: true, qr: qr(1) },
      { provider: 'Maya', accountName: 'Kaluppa Coffee', accountNumber: '0918 555 0202', showAtCheckout: false, qr: null },
    ];
    const res = await kaluppa.patch('/api/admin/settings/ewallet').send({ accounts });
    expect(res.status).toBe(200);
    const pay = (await buyer.get('/api/settings/payment')).body.data;
    expect(pay).toMatchObject({ providers: ['GCash'], isSample: false, accounts: { GCash: { accountNumber: '0917 555 0101', qrImageUrl: qr(1).url } } });
    expect(pay.accounts.Maya).toBeUndefined();
  });

  it('Maya is saved but off by default; turning it on puts it in the public providers with no code change', async () => {
    const providers = async () => (await request(app).get('/api/delivery/info').expect(200)).body.data.payment.providers;
    await kaluppa.patch('/api/admin/settings/ewallet').send({
      accounts: [
        { provider: 'GCash', accountName: 'Kaluppa Coffee', accountNumber: '0917 555 0101', showAtCheckout: true, qr: null },
        { provider: 'Maya', accountName: 'Kaluppa Coffee', accountNumber: '0918 555 0202', showAtCheckout: false, qr: null },
      ],
    }).expect(200);
    expect(await providers()).toEqual(['GCash']);
    const { accounts } = (await kaluppa.get('/api/admin/settings/ewallet')).body.data;
    await kaluppa.patch('/api/admin/settings/ewallet').send({ accounts: accounts.map((a) => ({ ...a, showAtCheckout: true })) }).expect(200);
    expect(await providers()).toEqual(['GCash', 'Maya']);
    expect((await buyer.get('/api/settings/payment')).body.data.providers).toEqual(['GCash', 'Maya']);
  });

  it('refuses a QR from someone else’s folder and hiding both', async () => {
    const foreign = { url: 'https://res.cloudinary.com/test/image/upload/v1/kapekonek/wallet-qr/x/q.png', publicId: 'kapekonek/wallet-qr/x/q' };
    const base = { accountName: 'Kaluppa Coffee', accountNumber: '0917 555 0101' };
    const bad = await kaluppa.patch('/api/admin/settings/ewallet').send({ accounts: [{ ...base, provider: 'GCash', showAtCheckout: true, qr: foreign }, { ...base, provider: 'Maya', showAtCheckout: true, qr: null }] });
    expect(bad.status).toBe(400);
    const none = await kaluppa.patch('/api/admin/settings/ewallet').send({ accounts: [{ ...base, provider: 'GCash', showAtCheckout: false, qr: null }, { ...base, provider: 'Maya', showAtCheckout: false, qr: null }] });
    expect(none.body.errors.accounts).toBe('Show at least one e-wallet at checkout');
  });
});

describe('Access and audit', () => {
  it('is Kaluppa’s only', async () => {
    expect((await buyer.get('/api/admin/settings/branch')).status).toBe(403);
    expect((await buyer.patch('/api/admin/settings/delivery').send({})).status).toBe(403);
  });

  it('records each save with what changed', async () => {
    const entries = await AuditLog.find({ area: 'settings' }).lean();
    expect(entries.map((e) => e.entityLabel)).toEqual(expect.arrayContaining(['Branch', 'Delivery fee', 'E-wallet']));
    const branchFields = entries.filter((e) => e.entityLabel === 'Branch').flatMap((e) => e.changes.map((c) => c.field));
    expect(branchFields).toEqual(expect.arrayContaining(['location', 'street', 'hours']));
  });
});
