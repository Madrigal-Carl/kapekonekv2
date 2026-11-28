import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSoldOrder, seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { Order, Product } = await import('../src/models/index.js');
const { JOBS } = await import('../src/queues/jobs.queue.js');
const { processJob } = await import('../src/queues/workers/jobs.worker.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let guest;
let farmer;
let buyer;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  await seedCatalogFixture();
  guest = request(app);
  farmer = await signedIn('kapekonek.farmer.approved@gmail.com');
  buyer = await signedIn('kapekonek.buyer@gmail.com');
});
afterAll(stopMemoryDb);

const slugs = (res) => res.body.data.map((p) => p.slug);

describe('GET /categories', () => {
  it('shows guests and buyers only public categories', async () => {
    expect((await guest.get('/api/categories')).body.data.map((c) => c.slug)).toEqual(['coffee']);
    expect((await buyer.get('/api/categories')).body.data.map((c) => c.slug)).toEqual(['coffee']);
  });

  it('shows farmers only the farm-supply categories they may buy (no Coffee)', async () => {
    expect((await farmer.get('/api/categories')).body.data.map((c) => c.slug)).toEqual(['fertilizer', 'beans']);
  });
});

describe('GET /products', () => {
  it('lists active products of visible categories with a total', async () => {
    const res = await guest.get('/api/products');
    expect(res.status).toBe(200);
    expect(slugs(res).sort()).toEqual(['arabica-light-roast', 'barako-medium-roast', 'liberica-green-beans', 'robusta-ground']);
    expect(res.body.meta).toMatchObject({ total: 4, hasMore: false, nextCursor: null });
    expect(res.body.data[0]).toMatchObject({ category: { slug: 'coffee', name: 'Coffee' } });
  });

  it('hides a category the viewer cannot see, even when asked for it', async () => {
    expect(slugs(await guest.get('/api/products?category=fertilizer'))).toEqual([]);
    expect(slugs(await farmer.get('/api/products?category=fertilizer'))).toEqual(['organic-fertilizer-25kg']);
  });

  it('lists only what a signed-in viewer may buy: farmers get farm supplies, buyers coffee', async () => {
    expect(slugs(await farmer.get('/api/products')).sort()).toEqual(['liberica-dried-cherry', 'organic-fertilizer-25kg']);
    expect(slugs(await farmer.get('/api/products?category=coffee'))).toEqual([]);
    expect(slugs(await buyer.get('/api/products')).sort()).toEqual(['arabica-light-roast', 'barako-medium-roast', 'liberica-green-beans', 'robusta-ground']);
  });

  it('filters by variety, coffee type, price (pesos) and search', async () => {
    expect(slugs(await guest.get('/api/products?variety=liberica,arabica&sort=price_asc'))).toEqual(['barako-medium-roast', 'liberica-green-beans', 'arabica-light-roast']);
    expect(slugs(await guest.get('/api/products?coffeeType=ground'))).toEqual(['robusta-ground']);
    expect(slugs(await guest.get('/api/products?minPrice=250&maxPrice=330&sort=price_asc'))).toEqual(['barako-medium-roast', 'liberica-green-beans']);
    expect(slugs(await guest.get('/api/products?search=bara'))).toEqual(['barako-medium-roast']);
  });

  it('rejects unknown sorts and too-large pages', async () => {
    const res = await guest.get('/api/products?sort=cheapest&limit=50');
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['limit', 'sort']);
  });

  it.each(['price_asc', 'rating', 'newest'])('pages through ties without duplicates or gaps (%s)', async (sort) => {
    const { _id: category } = (await Product.findOne({ slug: 'barako-medium-roast' })).toObject();
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await Product.insertMany(Array.from({ length: 7 }, (_, i) => ({
      category, name: `Tie ${sort} ${i}`, slug: `tie-${sort}-${i}`, unit: 'pack', stock: 5, priceCentavos: 15000, ratingAverage: 4.5, createdAt,
    })), { timestamps: false });
    const all = new Set();
    let cursor = '';
    let pages = 0;
    do {
      const res = await guest.get(`/api/products?sort=${sort}&limit=3${cursor ? `&cursor=${cursor}` : ''}`).expect(200);
      for (const slug of slugs(res)) {
        expect(all.has(slug)).toBe(false);
        all.add(slug);
      }
      cursor = res.body.meta.nextCursor;
      pages += 1;
    } while (cursor && pages < 20);
    const total = (await guest.get('/api/products')).body.meta.total;
    expect(all.size).toBe(total);
    await Product.deleteMany({ slug: /^tie-/ });
  });
});

describe('GET /products/:slug', () => {
  it('returns an active product with its category and purchasability', async () => {
    const res = await buyer.get('/api/products/barako-medium-roast');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Barako Medium Roast', purchasable: true, category: { slug: 'coffee' } });
  });

  it('404s for an inactive product or a hidden category', async () => {
    expect((await guest.get('/api/products/hidden-old-roast')).status).toBe(404);
    expect((await guest.get('/api/products/organic-fertilizer-25kg')).status).toBe(404);
    const asFarmer = await farmer.get('/api/products/organic-fertilizer-25kg');
    expect(asFarmer.status).toBe(200);
    expect(asFarmer.body.data.purchasable).toBe(true);
  });
});

describe('GET /products/best-sellers (Change 08)', () => {
  it('ranks by quantity in orders completed over 90 days, only from the viewer’s categories; newest fill the gaps', async () => {
    const p = Object.fromEntries((await Product.find().lean()).map((x) => [x.slug, x]));
    await createSoldOrder('kapekonek.buyer@gmail.com', p['robusta-ground'], { number: '9001' });
    await createSoldOrder('kapekonek.buyer@gmail.com', p['robusta-ground'], { number: '9002' });
    await createSoldOrder('kapekonek.buyer@gmail.com', p['arabica-light-roast'], { number: '9003' });
    const old = await createSoldOrder('kapekonek.buyer@gmail.com', p['barako-medium-roast'], { number: '9004' });
    await Order.updateOne({ _id: old._id }, { 'statusHistory.1.at': new Date(Date.now() - 91 * 86_400_000) }); // outside the 90 days
    expect(await processJob({ name: JOBS.PRODUCTS_BEST8 })).toEqual({ categories: 1 }); // the daily job; the farm-supply sales are none

    const best = (await guest.get('/api/products/best-sellers').expect(200)).body.data;
    expect(best.slice(0, 2).map((x) => [x.slug, x.rank, x.soldLast90Days])).toEqual([['robusta-ground', 1, 2], ['arabica-light-roast', 2, 1]]);
    expect(best.map((x) => x.slug).sort()).toEqual(['arabica-light-roast', 'barako-medium-roast', 'liberica-green-beans', 'robusta-ground']);
    expect(best.slice(2).every((x) => x.soldLast90Days === 0)).toBe(true);
    expect(slugs(await farmer.get('/api/products/best-sellers')).sort()).toEqual(['liberica-dried-cherry', 'organic-fertilizer-25kg']);
  });
});
