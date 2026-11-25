import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/clients/mapbox.client.js', () => ({
  drivingDistanceKm: vi.fn(),
  reverseGeocode: vi.fn(),
  forwardGeocode: vi.fn(),
}));

const mapbox = await import('../src/clients/mapbox.client.js');
const { quoteForAddress, quoteForPoint } = await import('../src/services/deliveryQuote.service.js');
const { haversineKm } = await import('../src/utils/deliveryFee.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');

const KALUPPA = { lat: 13.467, lng: 122.044 };
const MOGPOG = { lat: 13.4744, lng: 121.8619 };

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
});
afterAll(stopMemoryDb);
beforeEach(() => vi.resetAllMocks());

async function codeOf(promise) {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return [error.statusCode, error.code];
  }
}

describe('quoteForPoint', () => {
  it.each([[2, 5000], [3, 5000], [7.2, 9500]])('%s km costs %s centavos', async (km, fee) => {
    mapbox.drivingDistanceKm.mockResolvedValueOnce(km);
    const quote = await quoteForPoint({ lat: 13.40 + km / 1000, lng: 122.0 });
    expect(quote).toMatchObject({ distanceKm: km, feeCentavos: fee, distanceSource: 'mapbox' });
    expect(quote.eta.from).toBeInstanceOf(Date);
  });

  it('refuses a route longer than maxKm', async () => {
    mapbox.drivingDistanceKm.mockResolvedValueOnce(61);
    expect(await codeOf(quoteForPoint({ lat: 13.30, lng: 121.90 }))).toEqual([422, 'OUTSIDE_DELIVERY_AREA']);
  });

  it('refuses a point outside Marinduque without calling Mapbox', async () => {
    expect(await codeOf(quoteForPoint({ lat: 14.5995, lng: 120.9842 }))).toEqual([422, 'OUTSIDE_DELIVERY_AREA']);
    expect(mapbox.drivingDistanceKm).not.toHaveBeenCalled();
  });

  it('falls back to straight-line distance × 1.35 when Mapbox fails, and does not cache it', async () => {
    mapbox.drivingDistanceKm.mockRejectedValueOnce(new Error('timeout'));
    const quote = await quoteForPoint(MOGPOG);
    expect(quote.distanceSource).toBe('fallback');
    expect(quote.distanceKm).toBe(Math.round(haversineKm(KALUPPA, MOGPOG) * 1.35 * 10) / 10);
    mapbox.drivingDistanceKm.mockResolvedValueOnce(24);
    expect((await quoteForPoint(MOGPOG)).distanceSource).toBe('mapbox');
  });

  it('serves a second quote for the same 4-decimal point from the cache', async () => {
    mapbox.drivingDistanceKm.mockResolvedValue(12.3);
    await quoteForPoint({ lat: 13.38001, lng: 121.95001 });
    const again = await quoteForPoint({ lat: 13.380014, lng: 121.950012 });
    expect(again.distanceKm).toBe(12.3);
    expect(mapbox.drivingDistanceKm).toHaveBeenCalledTimes(1);
  });
});

describe('quoteForAddress', () => {
  const address = { municipality: 'Boac', barangay: 'Caganhao', street: 'Blue gate beside the sari-sari store' };

  it('asks for a pin when an unpinned address cannot be geocoded', async () => {
    mapbox.forwardGeocode.mockResolvedValueOnce([]);
    expect(await codeOf(quoteForAddress(address))).toEqual([422, 'ADDRESS_NEEDS_PIN']);
    mapbox.forwardGeocode.mockRejectedValueOnce(new Error('down'));
    expect(await codeOf(quoteForAddress({ ...address, street: 'Another street 1' }))).toEqual([422, 'ADDRESS_NEEDS_PIN']);
  });

  it('geocodes an unpinned address and quotes that point', async () => {
    mapbox.forwardGeocode.mockResolvedValueOnce([{ name: 'Caganhao', lat: 13.43, lng: 121.85 }]);
    mapbox.drivingDistanceKm.mockResolvedValueOnce(30.1);
    const quote = await quoteForAddress({ ...address, street: 'Third street 3' });
    expect(quote).toMatchObject({ distanceKm: 30.1, feeCentavos: 32500 });
    expect(mapbox.forwardGeocode.mock.calls[0][0]).toBe('Third street 3, Caganhao, Boac, Marinduque, Philippines');
  });

  it('uses the pin when there is one', async () => {
    mapbox.drivingDistanceKm.mockResolvedValueOnce(26.8);
    const quote = await quoteForAddress({ ...address, location: { type: 'Point', coordinates: [121.85, 13.44] } });
    expect(quote.feeCentavos).toBe(29000);
    expect(mapbox.forwardGeocode).not.toHaveBeenCalled();
  });

  it('refuses a municipality outside the list', async () => {
    expect(await codeOf(quoteForAddress({ ...address, municipality: 'Lucena' }))).toEqual([422, 'OUTSIDE_DELIVERY_AREA']);
  });
});

describe('routes', () => {
  async function signedIn(email) {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
    return agent;
  }

  it('/delivery/quote needs a verified sign-in', async () => {
    expect((await request(app).get('/api/delivery/quote?lat=13.4&lng=122')).status).toBe(401);
    const unverified = await signedIn('kapekonek.buyer.unverified@gmail.com');
    expect((await unverified.get('/api/delivery/quote?lat=13.4&lng=122')).body.code).toBe('EMAIL_NOT_VERIFIED');
    mapbox.drivingDistanceKm.mockResolvedValueOnce(5);
    const buyer = await signedIn('kapekonek.buyer@gmail.com');
    const res = await buyer.get('/api/delivery/quote?lat=13.41&lng=122.01');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ distanceKm: 5, feeCentavos: 7000, distanceSource: 'mapbox' });
    expect((await buyer.get('/api/delivery/quote')).status).toBe(400);
  });

  it('/geo/reverse takes municipality and barangay from the polygons and only the street from Mapbox', async () => {
    const buyer = await signedIn('kapekonek.buyer01@gmail.com');
    mapbox.reverseGeocode.mockResolvedValueOnce([{ name: 'Purok 3', context: { street: 'Purok 3', locality: 'Balanacan', place: 'Boac' } }]);
    const res = await buyer.get('/api/geo/reverse?lat=13.527&lng=121.87');
    expect(res.body.data).toEqual({ municipality: 'Mogpog', barangay: 'Balanacan', street: 'Purok 3', postalCode: '4901', insideDeliveryArea: true });

    // Mapbox names nothing of ours (or fails): the polygons still answer.
    mapbox.reverseGeocode.mockRejectedValueOnce(new Error('down'));
    const pantayin = await buyer.get('/api/geo/reverse?lat=13.44545&lng=122.05866');
    expect(pantayin.body.data).toMatchObject({ municipality: 'Santa Cruz', barangay: 'Pantayin', street: '', insideDeliveryArea: true });

    // Inside the old lat/lng box but in the sea north of the island.
    const sea = await buyer.get('/api/geo/reverse?lat=13.6&lng=121.85');
    expect(sea.body.data.insideDeliveryArea).toBe(false);
    expect(mapbox.reverseGeocode).toHaveBeenCalledTimes(2);

    const outside = await buyer.get('/api/geo/reverse?lat=14.6&lng=121');
    expect(outside.body.data.insideDeliveryArea).toBe(false);
  });

  it('/geo/search is free text only', async () => {
    const buyer = await signedIn('kapekonek.buyer02@gmail.com');
    expect((await buyer.get('/api/geo/search')).status).toBe(400);
    expect((await buyer.get('/api/geo/search?q=a')).status).toBe(400);
  });

  it('/locations gives each municipality its center', async () => {
    const res = await request(app).get('/api/locations');
    expect(res.body.data.find((t) => t.name === 'Santa Cruz').center).toEqual({ lat: 13.4778, lng: 122.03 });
  });

  it('/geo/search returns places inside Marinduque only', async () => {
    const buyer = await signedIn('kapekonek.buyer02@gmail.com');
    mapbox.forwardGeocode.mockResolvedValueOnce([
      { name: 'Boac Cathedral', fullAddress: 'Boac, Marinduque', lat: 13.447, lng: 121.84 },
      { name: 'Far away', fullAddress: 'Manila', lat: 14.6, lng: 121 },
    ]);
    const res = await buyer.get('/api/geo/search?q=boac');
    expect(res.body.data.map((p) => p.name)).toEqual(['Boac Cathedral']);
  });
});
