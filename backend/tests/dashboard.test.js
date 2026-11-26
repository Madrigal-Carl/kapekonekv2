import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { photosOf } from './helpers/beans.js';
import { documentsOf, registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';
import { makeOrder } from './helpers/orders.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));
vi.mock('../src/clients/cloudinary.client.js', () => ({
  getUploadedAsset: vi.fn(async () => ({ bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: 'doc' })),
  destroyImage: vi.fn(),
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User } = await import('../src/models/index.js');

let associations;
let waiting;
let catalog;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  const { products } = await seedCatalogFixture();
  catalog = products;
  associations = await setUpAssociations(app, User);
  for (const username of ['wanda', 'wes']) {
    const farmer = await registerFarmer(app, User, username);
    await farmer.agent.post('/api/me/farmer-profile/request').send({ associationId: associations.santacruz.id, ...documentsOf(farmer.user._id) }).expect(200);
    waiting = farmer;
  }
  const elsewhere = await registerFarmer(app, User, 'boacfarmer');
  await elsewhere.agent.post('/api/me/farmer-profile/request').send({ associationId: associations.boac.id, ...documentsOf(elsewhere.user._id) }).expect(200);
  // Wes (waiting for approval) lists 3 kg: his cap meter and Kaluppa's review count use it.
  await waiting.agent.post('/api/beans').send({ variety: 'liberica', form: 'dried_cherry', weightKg: 3, pricePerKgCentavos: 18_000, photos: photosOf(waiting.user._id, 1) }).expect(201);
  await makeOrder(products, { status: 'pending' });
  await makeOrder(products, { status: 'pending', paymentMethod: 'e_wallet' });
  await makeOrder(products, { status: 'sold' });
});
afterAll(stopMemoryDb);

describe('GET /dashboard/badges', () => {
  it('gives a Group Manager the farmers waiting in its own association only', async () => {
    const manager = await signedIn(app, 'manager.santacruz');
    expect((await manager.get('/api/dashboard/badges')).body.data).toEqual({ farmers: 2, inbox: 0 });
  });

  it('gives Kaluppa the orders to confirm and the bean listings to review', async () => {
    const kaluppa = await signedIn(app, 'kaluppa');
    expect((await kaluppa.get('/api/dashboard/badges')).body.data).toEqual({ orders: 2, beans: 1, reviews: 0, inbox: 0 });
  });

  it('gives a farmer only the inbox count, and is closed to buyers', async () => {
    expect((await waiting.agent.get('/api/dashboard/badges')).body.data).toEqual({ inbox: 0 });
    expect((await (await signedIn(app, 'buyer')).get('/api/dashboard/badges')).status).toBe(403);
  });
});

describe('GET /dashboard/org', () => {
  it('gives the sidebar card for a farmer, a Group Manager and nothing for Kaluppa', async () => {
    expect((await waiting.agent.get('/api/dashboard/org')).body.data).toEqual({ kind: 'farmer', status: 'pending', association: { id: associations.santacruz.id, name: 'Santa Cruz Growers' } });
    const manager = await signedIn(app, 'manager.santacruz');
    expect((await manager.get('/api/dashboard/org')).body.data).toEqual({ kind: 'group_manager', association: { id: associations.santacruz.id, name: 'Santa Cruz Growers' }, farmers: 0, waiting: 2 });
    expect((await (await signedIn(app, 'kaluppa')).get('/api/dashboard/org')).body.data).toBeNull();
  });
});

describe('GET /dashboard/overview', () => {
  it('farmer: status, association, cap and empty records', async () => {
    const { data } = (await waiting.agent.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({
      view: 'farmer',
      farmer: { status: 'pending', association: { name: 'Santa Cruz Growers' }, groupManager: { name: 'Liza Ramos' }, rejectionReason: null },
      cap: { usedKg: 3, limitKg: 5 },
      period: { key: 'month' },
      kpis: { farms: { count: 0 }, trees: { count: 0, groups: 0 }, harvest: { kg: 0, pct: null }, beansSold: { kg: 0, waiting: 1 } },
      treesByStage: [],
      orders: [],
    });
    expect(data.harvest).toHaveLength(data.period.labels.length);
    expect(data.beans).toEqual([expect.objectContaining({ status: 'pending', weightKg: 3, variety: 'liberica', farmerName: 'Wes Farmer' })]);
  });

  it('farmer: their three newest store orders', async () => {
    const { Order } = await import('../src/models/index.js');
    const email = (await User.findById(waiting.user._id).lean()).email;
    const made = [];
    for (let i = 0; i < 4; i += 1) made.push(await makeOrder(catalog, { email, items: [['organic-fertilizer-25kg', 2]], createdAt: new Date(Date.UTC(2026, 10, 10 + i)) }));
    const { orders } = (await waiting.agent.get('/api/dashboard/overview')).body.data;
    expect(orders.map((o) => o.orderNumber)).toEqual(made.slice(1).reverse().map((o) => o.orderNumber));
    expect(orders[0]).toMatchObject({ id: expect.any(String), firstItem: 'Organic Fertilizer 25 kg', itemCount: 1, totalCentavos: expect.any(Number), paymentMethod: 'cash', fulfillmentMethod: 'delivery', status: 'pending' });
    await Order.deleteMany({ _id: { $in: made.map((o) => o._id) } });
  });

  it('Group Manager: its association, counts and the approval queue', async () => {
    const manager = await signedIn(app, 'manager.santacruz');
    const { data } = (await manager.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({ view: 'group_manager', association: { name: 'Santa Cruz Growers' }, kpis: { farmers: 0, waiting: 2, farms: { count: 0 }, beans: { waitingKg: 3 } } });
    expect(data.queue.map((q) => q.name).sort()).toEqual(['Wanda Farmer', 'Wes Farmer']);
    expect(data.queue[0]).toMatchObject({ id: expect.any(String), initials: expect.any(String), requestedAt: expect.any(String) });
  });

  it('Kaluppa: orders to confirm, sales, farmers and low stock', async () => {
    const kaluppa = await signedIn(app, 'kaluppa');
    const { data } = (await kaluppa.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({
      view: 'kaluppa',
      kpis: { ordersToConfirm: 2, receiptsToCheck: 1, farmers: 0, waitingFarmers: 3, associations: 3, beanListingsToReview: 1 },
    });
    expect(data.kpis.sales.centavos).toBeGreaterThan(0);
    expect(data.sales.reduce((a, b) => a + b, 0)).toBe(data.kpis.sales.centavos);
    expect(data.kpis.beanKgOffered).toBe(3);
    expect(data.beans.map((b) => b.status)).toEqual(['pending']);
    expect(data.orders).toHaveLength(2);
    expect(data.orders[0]).toMatchObject({ id: expect.any(String), orderNumber: expect.stringMatching(/^KK-/), status: 'pending', buyerName: expect.any(String), buyerRole: 'buyer', paymentProvider: null });
    expect(Array.isArray(data.lowStock)).toBe(true);
  });
});
