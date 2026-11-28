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

const { enqueueEmail } = await import('../src/queues/email.queue.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Notification, Order, Product } = await import('../src/models/index.js');
const { ORDER_STATUSES } = await import('../src/constants/orderStatus.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let products;
let kaluppa;
let buyer;
const stockOf = async (slug) => (await Product.findOne({ slug }).lean()).stock;
const order = (options) => makeOrder(products, options);
const move = (id, body) => kaluppa.patch(`/api/orders/${id}/status`).send(body);
const REASON = { reasonCode: 'other', reason: 'Testing every transition' };

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  kaluppa = await signedIn('kapekonek.kaluppa@gmail.com');
  buyer = await signedIn('kapekonek.buyer@gmail.com');
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all([Order.deleteMany({}), Notification.deleteMany({}), Product.updateMany({}, { stock: 20, soldCount: 0 })]);
});

describe('staff transitions', () => {
  it('delivery + cash: reserve deducts stock and sets the ETA, rider shows, sold collects cash and counts sales', async () => {
    const o = await order();
    const reserved = await move(o._id, { status: 'reserved' });
    expect(reserved.status).toBe(200);
    expect(reserved.body.data).toMatchObject({ status: 'reserved', stockReserved: true });
    expect(reserved.body.data.fulfillment.etaFrom).toBeTruthy();
    expect(await stockOf('barako-medium-roast')).toBe(18);

    await move(o._id, { status: 'processing' }).expect(200);
    const out = await move(o._id, { status: 'out_for_delivery', rider: { name: 'Jun R.', phone: '0917 555 0102' }, note: 'Leaving at 9' });
    expect(out.body.data.fulfillment.rider).toEqual({ name: 'Jun R.', phone: '09175550102' });
    expect(out.body.data.statusHistory.at(-1)).toMatchObject({ status: 'out_for_delivery', note: 'Leaving at 9', byRole: 'kaluppa' });

    const sold = await move(o._id, { status: 'sold' });
    expect(sold.body.data.payment.cashCollectedAt).toBeTruthy();
    expect((await Product.findOne({ slug: 'barako-medium-roast' }).lean()).soldCount).toBe(2);
    expect(await stockOf('barako-medium-roast')).toBe(18);

    expect(enqueueEmail.mock.calls.map(([job, data]) => [job, data.status])).toEqual([
      ['order-status-changed', 'reserved'], ['order-status-changed', 'processing'], ['order-status-changed', 'out_for_delivery'], ['order-status-changed', 'sold'],
    ]);
    const notes = await Notification.find({ type: 'order_status' }).sort({ createdAt: 1 }).lean();
    expect(notes.map((n) => n.data.status)).toEqual(['reserved', 'processing', 'out_for_delivery', 'sold']);
    expect(notes[2].body).toContain('Jun R.');
  });

  it('pickup + e-wallet: reserve verifies the receipt; sold leaves cashCollectedAt empty', async () => {
    const o = await order({ method: 'pickup', paymentMethod: 'e_wallet' });
    const reserved = (await move(o._id, { status: 'reserved' })).body.data;
    expect(reserved.payment.verifiedAt).toBeTruthy();
    await move(o._id, { status: 'processing' }).expect(200);
    await move(o._id, { status: 'ready_for_pickup' }).expect(200);
    const sold = (await move(o._id, { status: 'sold' })).body.data;
    expect(sold.payment.cashCollectedAt).toBeUndefined();
    expect(sold.refund.status).toBe('not_applicable');
  });

  it('refuses every pair that is not in the transition table', async () => {
    const allowed = new Set([
      'pending>reserved', 'pending>rejected', 'reserved>rejected', 'reserved>processing', 'reserved>cancelled',
      'processing>cancelled', 'processing>out_for_delivery', 'out_for_delivery>cancelled', 'ready_for_pickup>cancelled',
      'out_for_delivery>sold', 'ready_for_pickup>sold',
    ]);
    const refused = [];
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        if (allowed.has(`${from}>${to}`)) continue;
        const o = await order({ status: from, stockReserved: false });
        const res = await move(o._id, { status: to, ...REASON, rider: { name: 'Jun R.', phone: '09175550102' } });
        if (res.status !== 409) refused.push(`${from}>${to}:${res.status}`);
      }
    }
    expect(refused).toEqual([]);
  });

  it('keeps out_for_delivery for delivery and ready_for_pickup for pickup', async () => {
    const pickup = await order({ method: 'pickup', status: 'processing' });
    expect((await move(pickup._id, { status: 'out_for_delivery' })).status).toBe(409);
    const delivery = await order({ status: 'processing' });
    expect((await move(delivery._id, { status: 'ready_for_pickup' })).status).toBe(409);
  });

  it('needs a reason code from the list, and words for "other"', async () => {
    const o = await order();
    expect((await move(o._id, { status: 'rejected' })).body.errors).toHaveProperty('reasonCode');
    expect((await move(o._id, { status: 'rejected', reasonCode: 'change_items' })).body.errors).toHaveProperty('reasonCode');
    expect((await move(o._id, { status: 'rejected', reasonCode: 'other' })).body.errors).toHaveProperty('reason');
    const res = await move(o._id, { status: 'rejected', reasonCode: 'invalid_receipt' });
    expect(res.body.data.rejection).toMatchObject({ reasonCode: 'invalid_receipt' });
  });

  it('is staff only', async () => {
    const o = await order();
    expect((await buyer.patch(`/api/orders/${o._id}/status`).send({ status: 'reserved' })).status).toBe(403);
  });
});

describe('stock', () => {
  it('rolls back and names the short item when one item cannot be reserved', async () => {
    await Product.updateOne({ slug: 'arabica-light-roast' }, { stock: 1 });
    const o = await order({ items: [['barako-medium-roast', 2], ['arabica-light-roast', 3]] });
    const res = await move(o._id, { status: 'reserved' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Arabica Light Roast');
    expect(res.body.message).not.toContain('Barako');
    expect(await stockOf('barako-medium-roast')).toBe(20);
    expect(await stockOf('arabica-light-roast')).toBe(1);
    expect((await Order.findById(o._id).lean()).status).toBe('pending');
  });

  it('gives the last unit to exactly one of two parallel reserves', async () => {
    await Product.updateOne({ slug: 'robusta-ground' }, { stock: 1 });
    const a = await order({ items: [['robusta-ground', 1]] });
    const b = await order({ items: [['robusta-ground', 1]] });
    const results = await Promise.all([move(a._id, { status: 'reserved' }), move(b._id, { status: 'reserved' })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await stockOf('robusta-ground')).toBe(0);
  });

  it('returns stock when a reserved order is cancelled or rejected', async () => {
    const a = await order();
    await move(a._id, { status: 'reserved' }).expect(200);
    await move(a._id, { status: 'cancelled', reasonCode: 'uncollected' }).expect(200);
    expect(await stockOf('barako-medium-roast')).toBe(20);
    const b = await order();
    await move(b._id, { status: 'reserved' }).expect(200);
    const rejected = await move(b._id, { status: 'rejected', reasonCode: 'out_of_stock' });
    expect(rejected.body.data.stockReserved).toBe(false);
    expect(await stockOf('barako-medium-roast')).toBe(20);
  });
});

describe('buyer cancel and refunds', () => {
  it('lets the buyer cancel only their own pending order, with a reason', async () => {
    const o = await order();
    expect((await buyer.post(`/api/orders/${o._id}/cancel`).send({ reasonCode: 'other' })).body.errors).toHaveProperty('reason');
    const other = await signedIn('kapekonek.buyer01@gmail.com');
    expect((await other.post(`/api/orders/${o._id}/cancel`).send({ reasonCode: 'ordered_by_mistake' })).status).toBe(404);
    const res = await buyer.post(`/api/orders/${o._id}/cancel`).send({ reasonCode: 'ordered_by_mistake' });
    expect(res.body.data).toMatchObject({ status: 'cancelled', cancellation: { reasonCode: 'ordered_by_mistake' }, refund: { status: 'not_applicable' } });
    expect(res.body.data.statusHistory.at(-1)).toMatchObject({ status: 'cancelled', byRole: 'buyer' });

    const reserved = await order({ status: 'reserved' });
    expect((await buyer.post(`/api/orders/${reserved._id}/cancel`).send({ reasonCode: 'change_items' })).status).toBe(409);
  });

  it('marks e-wallet refunds pending on cancel/reject, and Kaluppa marks them refunded once', async () => {
    const cancelled = await order({ paymentMethod: 'e_wallet' });
    const res = await buyer.post(`/api/orders/${cancelled._id}/cancel`).send({ reasonCode: 'wrong_receipt' });
    expect(res.body.data.refund.status).toBe('pending');
    const rejected = await order({ paymentMethod: 'e_wallet' });
    expect((await move(rejected._id, { status: 'rejected', reasonCode: 'amount_mismatch' })).body.data.refund.status).toBe('pending');

    const cash = await order();
    expect((await kaluppa.patch(`/api/orders/${cash._id}/refund`).send({ referenceNumber: '7023118842' })).status).toBe(409);
    const refunded = await kaluppa.patch(`/api/orders/${cancelled._id}/refund`).send({ referenceNumber: '7023118842' });
    expect(refunded.body.data.refund).toMatchObject({ status: 'refunded', referenceNumber: '7023118842' });
    expect((await kaluppa.patch(`/api/orders/${cancelled._id}/refund`).send({ referenceNumber: '7023118842' })).status).toBe(409);
    expect(await Notification.countDocuments({ 'data.refund': 'refunded' })).toBe(1);
  });
});
