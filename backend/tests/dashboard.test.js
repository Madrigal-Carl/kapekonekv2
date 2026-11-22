import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
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
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  const { products } = await seedCatalogFixture();
  associations = await setUpAssociations(app, User);
  for (const username of ['wanda', 'wes']) {
    const farmer = await registerFarmer(app, User, username);
    await farmer.agent.post('/api/me/farmer-profile/request').send({ associationId: associations.santacruz.id, ...documentsOf(farmer.user._id) }).expect(200);
    waiting = farmer;
  }
  const elsewhere = await registerFarmer(app, User, 'boacfarmer');
  await elsewhere.agent.post('/api/me/farmer-profile/request').send({ associationId: associations.boac.id, ...documentsOf(elsewhere.user._id) }).expect(200);
  await makeOrder(products, { status: 'pending' });
  await makeOrder(products, { status: 'pending', paymentMethod: 'e_wallet' });
  await makeOrder(products, { status: 'sold' });
});
afterAll(stopMemoryDb);

describe('GET /dashboard/badges', () => {
  it('gives a Group Manager the farmers waiting in its own association only', async () => {
    const manager = await signedIn(app, 'manager.santacruz');
    expect((await manager.get('/api/dashboard/badges')).body.data).toEqual({ farmers: 2 });
  });

  it('gives Kaluppa the orders to confirm', async () => {
    const kaluppa = await signedIn(app, 'kaluppa');
    expect((await kaluppa.get('/api/dashboard/badges')).body.data).toEqual({ orders: 2 });
  });

  it('has nothing for a farmer yet, and is closed to buyers', async () => {
    expect((await waiting.agent.get('/api/dashboard/badges')).body.data).toEqual({});
    expect((await (await signedIn(app, 'buyer')).get('/api/dashboard/badges')).status).toBe(403);
  });
});

describe('GET /dashboard/overview', () => {
  it('farmer: status, association, cap and empty records', async () => {
    const { data } = (await waiting.agent.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({
      view: 'farmer',
      farmer: { status: 'pending', association: { name: 'Santa Cruz Growers' }, groupManager: { name: 'Liza Ramos' }, rejectionReason: null },
      cap: { usedKg: 0, limitKg: 5 },
      kpis: { farms: 0, trees: 0, harvestThisYearKg: 0, beansSoldKg: 0 },
      harvestByMonth: { labels: expect.any(Array), values: expect.any(Array) },
      treesByStage: [],
      beans: [],
      orders: [],
    });
    expect(data.harvestByMonth.labels).toHaveLength(12);
  });

  it('Group Manager: its association, counts and the approval queue', async () => {
    const manager = await signedIn(app, 'manager.santacruz');
    const { data } = (await manager.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({ view: 'group_manager', association: { name: 'Santa Cruz Growers' }, kpis: { farmers: 0, waiting: 2, farms: 0 } });
    expect(data.queue.map((q) => q.name).sort()).toEqual(['Wanda Farmer', 'Wes Farmer']);
    expect(data.queue[0]).toMatchObject({ id: expect.any(String), initials: expect.any(String), requestedAt: expect.any(String) });
  });

  it('Kaluppa: orders to confirm, sales, farmers and low stock', async () => {
    const kaluppa = await signedIn(app, 'kaluppa');
    const { data } = (await kaluppa.get('/api/dashboard/overview')).body;
    expect(data).toMatchObject({
      view: 'kaluppa',
      kpis: { ordersToConfirm: 2, receiptsToCheck: 1, farmers: 0, waitingFarmers: 3, associations: 3, beanListingsToReview: 0 },
    });
    expect(data.kpis.salesThisMonthCentavos).toBeGreaterThan(0);
    expect(data.salesByMonth.values.at(-1)).toBe(data.kpis.salesThisMonthCentavos);
    expect(data.orders).toHaveLength(2);
    expect(data.orders[0]).toMatchObject({ id: expect.any(String), orderNumber: expect.stringMatching(/^KK-/), status: 'pending' });
    expect(Array.isArray(data.lowStock)).toBe(true);
  });
});
