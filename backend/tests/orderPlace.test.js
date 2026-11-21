import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
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
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { enqueueEmail } = await import('../src/queues/email.queue.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Cart, Notification, Order, Product, User } = await import('../src/models/index.js');
const { manilaDateKey } = await import('../src/utils/manilaDate.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'Password123!' }).expect(200);
  return agent;
}

const home = {
  label: 'Home', recipientName: 'Juana Dela Cruz', phone: '0917 123 4567', municipality: 'Mogpog', barangay: 'Balanacan',
  street: 'Lot 12, Purok 3, near the chapel', location: { lat: 13.5105, lng: 121.8668 },
};

let products;
let buyer;
let buyerId;
let addressId;
const receiptFor = (userId, name = 'gcash-nov21') => ({
  url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/receipts/${userId}/${name}.jpg`,
  publicId: `kapekonek/receipts/${userId}/${name}`,
});
const fillCart = (agent = buyer, slug = 'barako-medium-roast', quantity = 2) =>
  agent.post('/api/cart/items').send({ productId: String(products[slug]._id), quantity }).expect(200);
const place = (body, agent = buyer) => agent.post('/api/orders').send(body);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  buyer = await signedIn('buyer@kapekonek.test');
  buyerId = String((await User.findOne({ email: 'buyer@kapekonek.test' }))._id);
  addressId = (await buyer.post('/api/addresses').send(home)).body.data._id;
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all([Cart.deleteMany({}), Order.deleteMany({}), Notification.deleteMany({})]);
  await Product.updateMany({}, { stock: 20, isActive: true });
});

describe('placing an order', () => {
  it('delivery + cash on delivery: recomputes the fee, snapshots, clears the cart, emails and notifies', async () => {
    await fillCart();
    expect((await place({ method: 'delivery', paymentMethod: 'cash' })).body.errors).toHaveProperty('addressId');

    const res = await place({ method: 'delivery', addressId, paymentMethod: 'cash', deliveryFeeCentavos: 1, totalCentavos: 1, note: 'Blue gate' });
    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order.orderNumber).toMatch(new RegExp(`^KK-${manilaDateKey()}-\\d{4}$`));
    expect(order).toMatchObject({
      status: 'pending', subtotalCentavos: 52000, deliveryFeeCentavos: 29000, totalCentavos: 81000, note: 'Blue gate',
      fulfillment: { method: 'delivery', distanceKm: 26.8, distanceSource: 'mapbox', contactName: 'Juana Dela Cruz', contactPhone: '09171234567', address: { barangay: 'Balanacan', postalCode: '4901' } },
      payment: { method: 'cash', provider: null },
      refund: { status: 'not_applicable' },
    });
    expect(order.items[0]).toMatchObject({ slug: 'barako-medium-roast', quantity: 2, priceCentavos: 26000, lineTotalCentavos: 52000 });
    expect(order.statusHistory).toEqual([expect.objectContaining({ status: 'pending', byRole: 'buyer' })]);
    expect(order.eta.from).toBeTruthy();

    expect((await buyer.get('/api/cart')).body.data.lines).toEqual([]);
    expect(enqueueEmail.mock.calls.map(([job, data]) => [job, data.to])).toEqual([
      ['order-placed', 'buyer@kapekonek.test'],
      ['kaluppa-new-order', 'orders@kapekonek.test'],
    ]);
    const notes = await Notification.find().populate('user', 'email').lean();
    expect(notes.map((n) => [n.user.email, n.type, n.link]).sort()).toEqual([
      ['buyer@kapekonek.test', 'order_status', `/orders/${order._id}`],
      ['kaluppa@kapekonek.test', 'order_new', `/orders/${order._id}`],
    ]);
  });

  it('delivery + e-wallet needs a receipt from the buyer’s own folder', async () => {
    await fillCart();
    expect((await place({ method: 'delivery', addressId, paymentMethod: 'e_wallet', provider: 'GCash' })).body.errors).toHaveProperty('receipt');
    const stolen = await place({ method: 'delivery', addressId, paymentMethod: 'e_wallet', provider: 'GCash', receipt: receiptFor('5f0000000000000000000000') });
    expect(stolen.status).toBe(400);
    expect(stolen.body.errors).toHaveProperty('receipt');
    const outside = await place({ method: 'delivery', addressId, paymentMethod: 'e_wallet', provider: 'GCash', receipt: { url: 'https://res.cloudinary.com/test/image/upload/v1/kapekonek/avatars/x.jpg', publicId: 'kapekonek/avatars/x' } });
    expect(outside.status).toBe(400);

    const res = await place({ method: 'delivery', addressId, paymentMethod: 'e_wallet', provider: 'GCash', receipt: receiptFor(buyerId) });
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({ method: 'e_wallet', provider: 'GCash', receipt: receiptFor(buyerId) });
    expect(res.body.data.payment.submittedAt).toBeTruthy();
  });

  it('cash orders refuse a receipt', async () => {
    await fillCart();
    const res = await place({ method: 'pickup', contactPhone: '09170000000', paymentMethod: 'cash', receipt: receiptFor(buyerId) });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('receipt');
  });

  it('pickup needs a contact number (body or profile) and saves it to the profile', async () => {
    const pickupBuyer = await signedIn('buyer03@kapekonek.test');
    await User.updateOne({ email: 'buyer03@kapekonek.test' }, { $unset: { contactNumber: 1 } });
    await fillCart(pickupBuyer);
    const missing = await place({ method: 'pickup', paymentMethod: 'cash' }, pickupBuyer);
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toHaveProperty('contactPhone');

    const res = await place({ method: 'pickup', paymentMethod: 'cash', contactPhone: '0918 222 3333' }, pickupBuyer);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ deliveryFeeCentavos: 0, totalCentavos: 52000, fulfillment: { method: 'pickup', contactPhone: '09182223333', pickup: { name: 'Kaluppa' } } });
    expect((await User.findOne({ email: 'buyer03@kapekonek.test' })).contactNumber).toBe('09182223333');

    await fillCart(pickupBuyer);
    const fromProfile = await place({ method: 'pickup', paymentMethod: 'e_wallet', provider: 'Maya', receipt: receiptFor(res.body.data.buyer) }, pickupBuyer);
    expect(fromProfile.status).toBe(201);
    expect(fromProfile.body.data.fulfillment.contactPhone).toBe('09182223333');
  });

  it('places only one of two simultaneous orders', async () => {
    await fillCart();
    const results = await Promise.all([
      place({ method: 'pickup', paymentMethod: 'cash' }),
      place({ method: 'pickup', paymentMethod: 'cash' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('uses the current price and refuses items that are no longer available', async () => {
    await fillCart();
    await Product.updateOne({ slug: 'barako-medium-roast' }, { priceCentavos: 27000 });
    const res = await place({ method: 'pickup', paymentMethod: 'cash' });
    expect(res.body.data.items[0].priceCentavos).toBe(27000);
    await Product.updateOne({ slug: 'barako-medium-roast' }, { priceCentavos: 26000 });

    await fillCart();
    await fillCart(buyer, 'robusta-ground', 1);
    await Product.updateOne({ slug: 'robusta-ground' }, { isActive: false });
    const stale = await place({ method: 'pickup', paymentMethod: 'cash' });
    expect(stale.status).toBe(409);
    expect(stale.body.message).toContain('Robusta Ground');
    expect((await buyer.get('/api/cart')).body.data.lines).toHaveLength(2);

    await Product.updateOne({ slug: 'robusta-ground' }, { isActive: true, stock: 0 });
    expect((await place({ method: 'pickup', paymentMethod: 'cash' })).status).toBe(409);
  });

  it('refuses an empty cart and another user’s address', async () => {
    expect((await place({ method: 'pickup', paymentMethod: 'cash' })).status).toBe(409);
    const other = await signedIn('buyer01@kapekonek.test');
    await fillCart(other);
    expect((await place({ method: 'delivery', addressId, paymentMethod: 'cash' }, other)).status).toBe(404);
  });

  it('needs orders.create and a verified email', async () => {
    const farmer = await signedIn('farmer1@kapekonek.test');
    expect((await place({ method: 'pickup', paymentMethod: 'cash' }, farmer)).status).toBe(403);
    const unverified = await signedIn('buyer.unverified@kapekonek.test');
    expect((await place({ method: 'pickup', paymentMethod: 'cash' }, unverified)).body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('reading orders', () => {
  it('lists my orders newest first with cursor pages, counts per status, and hides other buyers’ orders', async () => {
    for (let i = 0; i < 3; i += 1) {
      await fillCart();
      await place({ method: 'pickup', paymentMethod: 'cash' }).expect(201);
    }
    await Order.updateOne({}, { status: 'cancelled' });
    const page1 = (await buyer.get('/api/orders?limit=2')).body;
    expect(page1.data).toHaveLength(2);
    expect(page1.meta.hasMore).toBe(true);
    const page2 = (await buyer.get(`/api/orders?limit=2&cursor=${encodeURIComponent(page1.meta.nextCursor)}`)).body;
    expect(page2.data).toHaveLength(1);
    expect(new Set([...page1.data, ...page2.data].map((o) => o._id)).size).toBe(3);

    expect((await buyer.get('/api/orders?status=cancelled,rejected')).body.data).toHaveLength(1);
    const counts = (await buyer.get('/api/orders/counts')).body.data;
    expect(counts).toMatchObject({ pending: 2, cancelled: 1, sold: 0 });

    const id = page1.data[0]._id;
    expect((await buyer.get(`/api/orders/${id}`)).body.data._id).toBe(id);
    const other = await signedIn('buyer02@kapekonek.test');
    expect((await other.get(`/api/orders/${id}`)).status).toBe(404);
    const kaluppa = await signedIn('kaluppa@kapekonek.test');
    expect((await kaluppa.get(`/api/orders/${id}`)).status).toBe(200);
  });
});
