import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { makeOrder } from './helpers/orders.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Order } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

const FARMER = 'kapekonek.farmer.approved@gmail.com';
let products;
let farmer;
let buyer;
const order = (options) => makeOrder(products, options);
const numbers = (res) => res.body.data.map((o) => o.orderNumber);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  farmer = await signedIn(FARMER);
  buyer = await signedIn('kapekonek.buyer@gmail.com');
});
afterAll(stopMemoryDb);
beforeEach(() => Order.deleteMany({}));

describe('GET /orders?page= (farmer Orders table)', () => {
  it('lists only the farmer’s own orders, numbered pages with a total', async () => {
    const mine = await order({ email: FARMER, items: [['organic-fertilizer-25kg', 2]] });
    await order(); // the buyer's
    const res = await farmer.get('/api/orders?page=1&limit=10');
    expect(res.status).toBe(200);
    expect(numbers(res)).toEqual([mine.orderNumber]);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1 });
  });

  it('filters by status group and searches the order number and item names', async () => {
    const pending = await order({ email: FARMER, items: [['organic-fertilizer-25kg', 1]] });
    const preparing = await order({ email: FARMER, status: 'processing', items: [['liberica-seedling', 10]] });
    const closed = await order({ email: FARMER, status: 'rejected', items: [['liberica-seedling', 5]] });
    expect(numbers(await farmer.get('/api/orders?page=1&group=to_confirm'))).toEqual([pending.orderNumber]);
    expect(numbers(await farmer.get('/api/orders?page=1&group=preparing'))).toEqual([preparing.orderNumber]);
    expect(numbers(await farmer.get('/api/orders?page=1&group=closed'))).toEqual([closed.orderNumber]);
    expect(numbers(await farmer.get('/api/orders?page=1&q=seedling')).sort()).toEqual([closed.orderNumber, preparing.orderNumber].sort());
    expect(numbers(await farmer.get(`/api/orders?page=1&q=${pending.orderNumber.slice(-4)}`))).toEqual([pending.orderNumber]);
    expect((await farmer.get('/api/orders?page=1&group=soon')).status).toBe(400);
  });

  it('keeps the Phase 1 cursor list when no page is asked for', async () => {
    await order();
    const res = await buyer.get('/api/orders?limit=10');
    expect(res.body.meta).toMatchObject({ hasMore: false, nextCursor: null });
  });
});
