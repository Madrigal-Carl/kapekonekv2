import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Setting } = await import('../src/models/index.js');
const { isValidBarangay } = await import('../src/services/location.service.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
});
afterAll(stopMemoryDb);

describe('GET /locations', () => {
  it('lists the 6 municipalities with postal codes and 218 barangays', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.status).toBe(200);
    const towns = res.body.data;
    expect(towns.map((t) => [t.name, t.postalCode])).toEqual([
      ['Boac', '4900'], ['Mogpog', '4901'], ['Santa Cruz', '4902'], ['Torrijos', '4903'], ['Buenavista', '4904'], ['Gasan', '4905'],
    ]);
    expect(towns.reduce((n, t) => n + t.barangays.length, 0)).toBe(218);
  });

  it('checks a barangay belongs to its municipality', () => {
    expect(isValidBarangay('Mogpog', 'Balanacan')).toBe(true);
    expect(isValidBarangay('Boac', 'Balanacan')).toBe(false);
    expect(isValidBarangay('Manila', 'Balanacan')).toBe(false);
  });
});

describe('GET /delivery/info', () => {
  it('is public and shows pickup, fee rules and ETA days without the origin pin', async () => {
    const res = await request(app).get('/api/delivery/info');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      pickup: { name: 'Kaluppa', address: 'Pantayin, Santa Cruz, Marinduque', hours: expect.any(String), location: { lat: expect.any(Number), lng: expect.any(Number) } },
      fee: { baseFeeCentavos: 5000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60 },
      eta: { minBusinessDays: 3, maxBusinessDays: 5 },
    });
    expect(JSON.stringify(res.body.data)).not.toMatch(/origin|roadFactor/);
  });

  it('reflects stored settings over the defaults', async () => {
    await Setting.create({ key: 'delivery.eta', value: { minBusinessDays: 2, maxBusinessDays: 4 } });
    expect((await request(app).get('/api/delivery/info')).body.data.eta).toEqual({ minBusinessDays: 2, maxBusinessDays: 4 });
    await Setting.deleteOne({ key: 'delivery.eta' });
  });
});

describe('settings', () => {
  it('serves landing hero slides to anyone', async () => {
    const res = await request(app).get('/api/settings/landing');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ heroSlides: expect.any(Array) });
  });

  it('shows e-wallet details only to a verified, signed-in user', async () => {
    expect((await request(app).get('/api/settings/payment')).status).toBe(401);
    const unverified = await signedIn('kapekonek.buyer.unverified@gmail.com');
    expect((await unverified.get('/api/settings/payment')).body.code).toBe('EMAIL_NOT_VERIFIED');
    const res = await (await signedIn('kapekonek.buyer@gmail.com')).get('/api/settings/payment');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ providers: ['GCash', 'Maya'], isSample: true, accountName: expect.any(String), accountNumber: expect.any(String) });
  });
});
