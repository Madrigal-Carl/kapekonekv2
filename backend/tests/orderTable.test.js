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
let kaluppa;
const order = (options) => makeOrder(products, options);
const numbers = (res) => res.body.data.map((o) => o.orderNumber);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  farmer = await signedIn(FARMER);
  buyer = await signedIn('kapekonek.buyer@gmail.com');
  kaluppa = await signedIn('kapekonek.kaluppa@gmail.com');
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

describe('GET /admin/orders (Kaluppa Orders table)', () => {
  it('lists buyer and farmer orders with the customer, filtered by customer type, method and payment', async () => {
    const fromBuyer = await order({ paymentMethod: 'e_wallet' });
    const fromFarmer = await order({ email: FARMER, method: 'pickup', items: [['organic-fertilizer-25kg', 1]] });
    const all = await kaluppa.get('/api/admin/orders?status=all&page=1');
    expect(all.status).toBe(200);
    expect(numbers(all).sort()).toEqual([fromBuyer.orderNumber, fromFarmer.orderNumber].sort());
    expect(all.body.meta).toEqual({ page: 1, limit: 10, total: 2 });
    const row = all.body.data.find((o) => o.orderNumber === fromFarmer.orderNumber);
    expect(row.customer).toMatchObject({ name: expect.any(String), role: 'farmer' });
    expect(numbers(await kaluppa.get('/api/admin/orders?status=all&type=farmer'))).toEqual([fromFarmer.orderNumber]);
    expect(numbers(await kaluppa.get('/api/admin/orders?status=all&type=buyer'))).toEqual([fromBuyer.orderNumber]);
    expect(numbers(await kaluppa.get('/api/admin/orders?status=all&method=pickup'))).toEqual([fromFarmer.orderNumber]);
    expect(numbers(await kaluppa.get('/api/admin/orders?status=all&payment=e_wallet'))).toEqual([fromBuyer.orderNumber]);
  });

  it('defaults to the orders to confirm and searches the customer name', async () => {
    const waiting = await order({ email: FARMER });
    await order({ status: 'sold' });
    expect(numbers(await kaluppa.get('/api/admin/orders'))).toEqual([waiting.orderNumber]);
    const { firstName } = (await farmer.get('/api/auth/me')).body.data.user;
    expect(numbers(await kaluppa.get(`/api/admin/orders?status=all&q=${firstName}`))).toEqual([waiting.orderNumber]);
  });

  it('is Kaluppa’s only: farmers and buyers get 403', async () => {
    expect((await farmer.get('/api/admin/orders')).status).toBe(403);
    expect((await buyer.get('/api/admin/orders')).status).toBe(403);
    expect((await request(app).get('/api/admin/orders')).status).toBe(401);
  });

  it('gives Kaluppa the customer on the order detail; the owner sees the same order without it', async () => {
    const o = await order({ email: FARMER });
    const asKaluppa = (await kaluppa.get(`/api/orders/${o._id}`)).body.data;
    expect(asKaluppa.customer).toMatchObject({ role: 'farmer', name: expect.any(String) });
    expect((await farmer.get(`/api/orders/${o._id}`)).body.data.customer).toBeUndefined();
  });

  it('exports the filtered orders as CSV', async () => {
    const o = await order({ email: FARMER });
    const res = await kaluppa.get('/api/admin/orders/export.csv?status=all&type=farmer');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split(/\r?\n/);
    expect(lines[0]).toBe('Order,Placed,Customer,Customer type,Items,Total (PHP),Delivery,Payment,Status');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain(o.orderNumber);
    expect((await farmer.get('/api/admin/orders/export.csv')).status).toBe(403);
  });
});
