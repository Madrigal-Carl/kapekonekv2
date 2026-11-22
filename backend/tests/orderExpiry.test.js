import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { makeOrder } from './helpers/orders.js';

let redis;
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { runSeeders } = await import('../src/database/seeders/index.js');
const { Order, Product, User } = await import('../src/models/index.js');
const { expirePendingOrders, transition } = await import('../src/services/orderStatus.service.js');
const { runOrderExpiry } = await import('../src/services/orderExpiry.service.js');

const DAY = 86_400_000;
let products;
let kaluppa;
const ago = (days) => new Date(Date.now() - days * DAY);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  kaluppa = await User.findOne({ email: 'kapekonek.kaluppa@gmail.com' });
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  await Order.deleteMany({});
  await Product.updateMany({}, { stock: 20 });
  await redis.flushall();
});

describe('order expiry', () => {
  it('expires only pending orders older than ORDER_EXPIRY_DAYS, with refunds for e-wallet', async () => {
    const old = await makeOrder(products, { createdAt: ago(4), paymentMethod: 'e_wallet' });
    const oldCash = await makeOrder(products, { createdAt: ago(3.1) });
    const fresh = await makeOrder(products, { createdAt: ago(2) });
    const reserved = await makeOrder(products, { createdAt: ago(5), status: 'reserved' });
    expect(await expirePendingOrders(new Date())).toBe(2);
    const byId = Object.fromEntries((await Order.find().lean()).map((o) => [String(o._id), o]));
    expect(byId[old._id].status).toBe('expired');
    expect(byId[old._id].refund.status).toBe('pending');
    expect(byId[old._id].statusHistory.at(-1)).toMatchObject({ status: 'expired', by: null, byRole: 'system' });
    expect(byId[oldCash._id]).toMatchObject({ status: 'expired', refund: { status: 'not_applicable' } });
    expect(byId[oldCash._id].expiredAt).toBeTruthy();
    expect(byId[fresh._id].status).toBe('pending');
    expect(byId[reserved._id].status).toBe('reserved');
  });

  it('leaves an order reserved when Kaluppa confirmed it first', async () => {
    const o = await makeOrder(products, { createdAt: ago(4) });
    await transition(kaluppa, o._id, { status: 'reserved' });
    expect(await expirePendingOrders(new Date())).toBe(0);
    expect((await Order.findById(o._id).lean()).status).toBe('reserved');
  });

  it('keeps stock and status consistent when expiry and a reserve race', async () => {
    const o = await makeOrder(products, { createdAt: ago(4) });
    await Promise.allSettled([transition(kaluppa, o._id, { status: 'reserved' }), expirePendingOrders(new Date())]);
    const { status } = await Order.findById(o._id).lean();
    const stock = (await Product.findOne({ slug: 'barako-medium-roast' }).lean()).stock;
    expect([['reserved', 18], ['expired', 20]]).toContainEqual([status, stock]);
  });

  it('skips the sweep while another run holds the lock', async () => {
    await makeOrder(products, { createdAt: ago(4) });
    await redis.set('lock:order-expiry', 'someone-else', 'PX', 60_000);
    expect(await runOrderExpiry()).toEqual({ expired: 0, skipped: true });
    await redis.del('lock:order-expiry');
    expect(await runOrderExpiry()).toEqual({ expired: 1 });
  });
});
