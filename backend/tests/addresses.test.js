import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/clients/mapbox.client.js', () => ({
  drivingDistanceKm: vi.fn(async () => 26.8),
  reverseGeocode: vi.fn(async () => []),
  forwardGeocode: vi.fn(async () => []),
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Address } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

const home = {
  label: 'Home',
  recipientName: 'Juana Dela Cruz',
  phone: '0917 123 4567',
  municipality: 'Mogpog',
  barangay: 'Balanacan',
  street: 'Lot 12, Purok 3, near the chapel',
  location: { lat: 13.5105, lng: 121.8668 },
};

let buyer;
let other;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  buyer = await signedIn('kapekonek.buyer@gmail.com');
  other = await signedIn('kapekonek.buyer01@gmail.com');
});
afterAll(stopMemoryDb);
beforeEach(() => Address.deleteMany({}));

describe('addresses', () => {
  it('needs a signed-in user with addresses.manage (buyers and farmers)', async () => {
    expect((await request(app).get('/api/addresses')).status).toBe(401);
    const manager = await signedIn('kapekonek.manager.santacruz@gmail.com');
    expect((await manager.get('/api/addresses')).status).toBe(403);
    const farmer = await signedIn('kapekonek.farmer.approved@gmail.com');
    expect((await farmer.get('/api/addresses')).status).toBe(200);
  });

  it('makes the first address the default, derives the postal code and lists the quote', async () => {
    const res = await buyer.post('/api/addresses').send({ ...home, postalCode: '9999', province: 'Quezon' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ isDefault: true, postalCode: '4901', province: 'Marinduque', phone: '09171234567', pinned: true, location: home.location });

    await buyer.post('/api/addresses').send({ ...home, label: 'Other', customLabel: 'Mama’s house', municipality: 'Boac', barangay: 'Caganhao', location: null }).expect(201);
    const list = (await buyer.get('/api/addresses')).body.data;
    expect(list.map((a) => [a.label, a.isDefault, a.pinned])).toEqual([['Home', true, true], ['Other', false, false]]);
    expect(list[0].quote).toMatchObject({ distanceKm: 26.8, feeCentavos: 29000 });
    expect(list[1]).toMatchObject({ quote: null, quoteError: 'ADDRESS_NEEDS_PIN', postalCode: '4900' });
  });

  it('refuses an 11th address', async () => {
    for (let i = 0; i < 10; i += 1) await buyer.post('/api/addresses').send(home).expect(201);
    const res = await buyer.post('/api/addresses').send(home);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'CONFLICT', message: 'You can save up to 10 addresses' });
  });

  it('promotes the newest remaining address when the default is deleted', async () => {
    const first = (await buyer.post('/api/addresses').send(home)).body.data;
    await buyer.post('/api/addresses').send({ ...home, label: 'Work' }).expect(201);
    const newest = (await buyer.post('/api/addresses').send({ ...home, label: 'Other', customLabel: 'Farm' })).body.data;
    await buyer.delete(`/api/addresses/${first._id}`).expect(200);
    const list = (await buyer.get('/api/addresses')).body.data;
    expect(list).toHaveLength(2);
    expect(list.find((a) => a.isDefault)._id).toBe(newest._id);
    expect(await Address.countDocuments({ deletedAt: { $ne: null } })).toBe(1);
  });

  it('sets a new default and keeps exactly one', async () => {
    await buyer.post('/api/addresses').send(home).expect(201);
    const work = (await buyer.post('/api/addresses').send({ ...home, label: 'Work', isDefault: true })).body.data;
    expect(work.isDefault).toBe(true);
    const first = (await buyer.get('/api/addresses')).body.data.find((a) => a.label === 'Home');
    await buyer.post(`/api/addresses/${first._id}/default`).expect(200);
    const list = (await buyer.get('/api/addresses')).body.data;
    expect(list.filter((a) => a.isDefault).map((a) => a.label)).toEqual(['Home']);
  });

  it("hides another user's address", async () => {
    const mine = (await buyer.post('/api/addresses').send(home)).body.data;
    expect((await other.patch(`/api/addresses/${mine._id}`).send(home)).status).toBe(404);
    expect((await other.delete(`/api/addresses/${mine._id}`)).status).toBe(404);
    expect((await other.post(`/api/addresses/${mine._id}/default`)).status).toBe(404);
  });

  it('updates an address and can remove its pin', async () => {
    const mine = (await buyer.post('/api/addresses').send(home)).body.data;
    const res = await buyer.patch(`/api/addresses/${mine._id}`).send({ ...home, municipality: 'Santa Cruz', barangay: 'Banahaw Poblacion', location: null });
    expect(res.body.data).toMatchObject({ municipality: 'Santa Cruz', postalCode: '4902', pinned: false, location: null, isDefault: true });
  });

  it('validates the barangay against the municipality and the pin against Marinduque', async () => {
    const res = await buyer.post('/api/addresses').send({ ...home, barangay: 'Caganhao', location: { lat: 14.6, lng: 121 } });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['barangay', 'location']);
    const missingLabel = await buyer.post('/api/addresses').send({ ...home, label: 'Other' });
    expect(missingLabel.body.errors).toHaveProperty('customLabel');
  });

  it('lets farmers, not buyers, label an address Farm', async () => {
    const refused = await buyer.post('/api/addresses').send({ ...home, label: 'Farm' });
    expect(refused.status).toBe(400);
    expect(refused.body).toMatchObject({ code: 'VALIDATION_ERROR', errors: { label: 'Choose Home, Work or Other' } });
    const farmer = await signedIn('kapekonek.farmer.approved@gmail.com');
    expect((await farmer.post('/api/addresses').send({ ...home, label: 'Farm' })).body.data).toMatchObject({ label: 'Farm' });
  });

  it('quotes a saved address through /delivery/quote?addressId', async () => {
    const mine = (await buyer.post('/api/addresses').send(home)).body.data;
    const res = await buyer.get(`/api/delivery/quote?addressId=${mine._id}`);
    expect(res.body.data).toMatchObject({ distanceKm: 26.8, feeCentavos: 29000 });
    expect((await other.get(`/api/delivery/quote?addressId=${mine._id}`)).status).toBe(404);
  });
});
