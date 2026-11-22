import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Cart, Product } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'Password123!' }).expect(200);
  return agent;
}

let products;
let buyer;
const id = (slug) => String(products[slug]._id);
const add = (slug, quantity) => buyer.post('/api/cart/items').send({ productId: id(slug), quantity });

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  buyer = await signedIn('buyer@kapekonek.test');
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  await Cart.deleteMany({});
  await Product.updateMany({}, { stock: 20, isActive: true });
  await Product.updateOne({ slug: 'hidden-old-roast' }, { isActive: false });
});

describe('cart', () => {
  it('needs a verified buyer', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
    const unverified = await signedIn('buyer.unverified@kapekonek.test');
    const res = await unverified.get('/api/cart');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('starts empty', async () => {
    const res = await buyer.get('/api/cart');
    expect(res.body.data).toEqual({ lines: [], count: 0, subtotalCentavos: 0, canCheckout: false });
  });

  it('adds, merges, changes and removes lines', async () => {
    await add('barako-medium-roast', 2).expect(200);
    await add('barako-medium-roast', 1).expect(200);
    const res = await add('liberica-green-beans', 1.5);
    const { lines, subtotalCentavos, canCheckout, count } = res.body.data;
    expect(lines.map((l) => [l.product.slug, l.quantity, l.lineTotalCentavos, l.flags])).toEqual([
      ['barako-medium-roast', 3, 78000, []],
      ['liberica-green-beans', 1.5, 48000, []],
    ]);
    expect({ subtotalCentavos, canCheckout, count }).toEqual({ subtotalCentavos: 126000, canCheckout: true, count: 2 });

    const changed = await buyer.patch(`/api/cart/items/${id('barako-medium-roast')}`).send({ quantity: 1 });
    expect(changed.body.data.lines[0].quantity).toBe(1);
    const removed = await buyer.delete(`/api/cart/items/${id('liberica-green-beans')}`);
    expect(removed.body.data.lines).toHaveLength(1);
    expect((await buyer.patch(`/api/cart/items/${id('robusta-ground')}`).send({ quantity: 1 })).status).toBe(404);
    const cleared = await buyer.delete('/api/cart');
    expect(cleared.body.data.lines).toEqual([]);
  });

  it('enforces the quantity step of the unit', async () => {
    const kg = await add('liberica-green-beans', 0.75);
    expect(kg.status).toBe(400);
    expect(kg.body.errors.quantity).toBe('Use 0.5 kg steps');
    const pack = await add('barako-medium-roast', 1.5);
    expect(pack.status).toBe(400);
    expect(pack.body.errors.quantity).toBe('Use whole numbers');
  });

  it("refuses coffee to a farmer (no catalog.coffee) and hidden products to everyone", async () => {
    const farmer = await signedIn('farmer1@kapekonek.test');
    expect((await farmer.post('/api/cart/items').send({ productId: id('barako-medium-roast'), quantity: 1 })).status).toBe(403);
    expect((await add('hidden-old-roast', 1)).status).toBe(404);
    expect((await add('organic-fertilizer-25kg', 1)).status).toBe(404);
  });

  it('flags lines that can no longer be checked out', async () => {
    await add('barako-medium-roast', 4).expect(200);
    await add('robusta-ground', 1).expect(200);
    await add('arabica-light-roast', 1).expect(200);
    await Product.updateOne({ slug: 'barako-medium-roast' }, { stock: 3 });
    await Product.updateOne({ slug: 'robusta-ground' }, { stock: 0 });
    await Product.updateOne({ slug: 'arabica-light-roast' }, { isActive: false });
    const { lines, canCheckout, subtotalCentavos } = (await buyer.get('/api/cart')).body.data;
    expect(lines.map((l) => [l.product.slug, l.flags])).toEqual([
      ['barako-medium-roast', ['OVER_STOCK']],
      ['robusta-ground', ['OUT_OF_STOCK']],
      ['arabica-light-roast', ['INACTIVE']],
    ]);
    expect(canCheckout).toBe(false);
    expect(subtotalCentavos).toBe(4 * 26000 + 20000);
  });

  it('adds to the line and refuses a total above stock (packs)', async () => {
    await Product.updateOne({ slug: 'barako-medium-roast' }, { stock: 3 });
    await add('barako-medium-roast', 2).expect(200);
    const res = await add('barako-medium-roast', 2);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('QUANTITY_EXCEEDS_STOCK');
    expect(res.body.data).toEqual({ stock: 3, inCart: 2, maxAddable: 1 });
    expect((await buyer.get('/api/cart')).body.data.lines[0]).toMatchObject({ quantity: 2, inCart: 2 });
    await add('barako-medium-roast', 1).expect(200);
    expect((await add('barako-medium-roast', 1)).body.data).toEqual({ stock: 3, inCart: 3, maxAddable: 0 });
  });

  it('two adds at the same moment never push the line past stock', async () => {
    await Product.updateOne({ slug: 'barako-medium-roast' }, { stock: 3 });
    const results = await Promise.all([add('barako-medium-roast', 2), add('barako-medium-roast', 2)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await buyer.get('/api/cart')).body.data.lines[0].quantity).toBe(2);
  });

  it('checks kg totals in exact 0.5 steps', async () => {
    await Product.updateOne({ slug: 'liberica-green-beans' }, { stock: 3 });
    await add('liberica-green-beans', 2.5).expect(200);
    const over = await add('liberica-green-beans', 1);
    expect(over.status).toBe(409);
    expect(over.body.data).toEqual({ stock: 3, inCart: 2.5, maxAddable: 0.5 });
    const ok = await add('liberica-green-beans', 0.5);
    expect(ok.status).toBe(200);
    expect(ok.body.data.lines[0].quantity).toBe(3);
  });

  it('refuses to set a line above stock (PATCH)', async () => {
    await Product.updateOne({ slug: 'barako-medium-roast' }, { stock: 3 });
    await add('barako-medium-roast', 1).expect(200);
    const res = await buyer.patch(`/api/cart/items/${id('barako-medium-roast')}`).send({ quantity: 4 });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'QUANTITY_EXCEEDS_STOCK', data: { stock: 3, inCart: 1, maxAddable: 2 } });
    await buyer.patch(`/api/cart/items/${id('barako-medium-roast')}`).send({ quantity: 3 }).expect(200);
  });

  it('tells the product page how many are already in the cart', async () => {
    await add('barako-medium-roast', 2).expect(200);
    expect((await buyer.get('/api/products/barako-medium-roast')).body.data.inCart).toBe(2);
    expect((await buyer.get('/api/products/liberica-green-beans')).body.data.inCart).toBe(0);
    expect((await request(app).get('/api/products/barako-medium-roast')).body.data.inCart).toBe(0);
  });

  it('refuses to add a sold-out product', async () => {
    await Product.updateOne({ slug: 'robusta-ground' }, { stock: 0 });
    expect((await add('robusta-ground', 1)).status).toBe(409);
  });
});

describe('upload signatures', () => {
  it('signs a receipt or avatar upload into the user’s own folder, with the image limit', async () => {
    expect((await request(app).post('/api/uploads/signature').send({ purpose: 'receipt' })).status).toBe(401);
    const res = await buyer.post('/api/uploads/signature').send({ purpose: 'receipt' });
    expect(res.status).toBe(200);
    const me = (await buyer.get('/api/auth/me')).body.data.user;
    expect(res.body.data).toMatchObject({ folder: `kapekonek/receipts/${me.id}`, apiKey: 'test', allowedFormats: 'jpg,jpeg,png,webp,heic,heif', kind: 'image', maxBytes: 5 * 1024 * 1024 });
    expect(res.body.data.signature).toMatch(/^[a-f0-9]{40}$/);
    const avatar = await buyer.post('/api/uploads/signature').send({ purpose: 'avatar' });
    expect(avatar.body.data).toMatchObject({ folder: `kapekonek/avatars/${me.id}`, kind: 'image', maxBytes: 5 * 1024 * 1024 });
    expect((await buyer.post('/api/uploads/signature').send({ purpose: 'product' })).status).toBe(400);
  });
});
