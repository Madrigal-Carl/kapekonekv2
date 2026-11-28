import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, Product } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let kaluppa;
let buyer;
let farmer;
let photos;
const body = (fields = {}) => ({
  name: 'Excelsa Dark Roast',
  category: 'coffee',
  variety: 'excelsa',
  coffeeType: 'roasted_beans',
  unit: 'pack',
  priceCentavos: 29000,
  stock: 38,
  description: 'Bold and smoky.',
  photos: photos.slice(0, 3),
  isActive: true,
  ...fields,
});
const thumbOf = (product) => product.photos.filter((p) => p.isThumbnail);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  await seedCatalogFixture();
  kaluppa = await signedIn('kapekonek.kaluppa@gmail.com');
  buyer = await signedIn('kapekonek.buyer@gmail.com');
  farmer = await signedIn('kapekonek.farmer.approved@gmail.com');
  const id = (await kaluppa.get('/api/auth/me')).body.data.user.id;
  photos = Array.from({ length: 6 }, (_, i) => ({
    url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/product-photos/${id}/p${i}.jpg`,
    publicId: `kapekonek/product-photos/${id}/p${i}`,
  }));
});
afterAll(stopMemoryDb);

describe('Inventory: photos and the thumbnail', () => {
  it('makes the first photo the thumbnail by default and keeps exactly one', async () => {
    const res = await kaluppa.post('/api/admin/products').send(body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: 'excelsa-dark-roast', unitLabel: '250 g', category: { slug: 'coffee' } });
    expect(thumbOf(res.body.data)).toEqual([{ ...photos[0], isThumbnail: true }]);
  });

  it('moves a picked thumbnail first, so cards, the cart and order snapshots show it', async () => {
    const created = (await kaluppa.post('/api/admin/products').send(body({ name: 'Picked Thumb Roast' }))).body.data;
    const picked = photos.slice(0, 3).map((p, i) => ({ ...p, isThumbnail: i === 2 }));
    const res = await kaluppa.patch(`/api/admin/products/${created._id}`).send(body({ name: 'Picked Thumb Roast', photos: picked }));
    expect(res.status).toBe(200);
    expect(res.body.data.photos.map((p) => p.publicId)).toEqual([photos[2], photos[0], photos[1]].map((p) => p.publicId));
    expect(thumbOf(res.body.data)).toHaveLength(1);

    const card = (await request(app).get('/api/products?category=coffee&limit=24')).body.data.find((p) => p._id === created._id);
    expect(card.images[0].url).toBe(photos[2].url);
    await buyer.post('/api/cart/items').send({ productId: created._id, quantity: 1 }).expect(200);
    const line = (await buyer.get('/api/cart')).body.data.lines.find((i) => i.product._id === created._id);
    expect(line.product.image).toBe(photos[2].url);
    await buyer.delete('/api/cart').expect(200);
  });

  it('promotes the first remaining photo when the thumbnail is deleted', async () => {
    const created = (await kaluppa.post('/api/admin/products').send(body({ name: 'Delete Thumb Roast' }))).body.data;
    const res = await kaluppa.patch(`/api/admin/products/${created._id}`).send(body({ name: 'Delete Thumb Roast', photos: [photos[1], photos[2]] }));
    expect(thumbOf(res.body.data)).toEqual([{ ...photos[1], isThumbnail: true }]);
  });

  it('refuses two thumbnails, more than five photos and photos from someone else’s folder', async () => {
    const two = photos.slice(0, 2).map((p) => ({ ...p, isThumbnail: true }));
    expect((await kaluppa.post('/api/admin/products').send(body({ photos: two }))).body.errors.photos).toBe('Pick one thumbnail');
    expect((await kaluppa.post('/api/admin/products').send(body({ photos }))).body.errors.photos).toBe('Add up to 5 photos');
    const foreign = [{ url: 'https://res.cloudinary.com/test/image/upload/v1/kapekonek/product-photos/x/p.jpg', publicId: 'kapekonek/product-photos/x/p' }];
    expect((await kaluppa.post('/api/admin/products').send(body({ photos: foreign }))).status).toBe(400);
  });
});

describe('Inventory: category rules', () => {
  it('allows the units of the category; Beans sells by kg or sack (Change 08)', async () => {
    const fertilizer = { name: 'Urea Sack', category: 'fertilizer', variety: null, coffeeType: null, unit: 'sack' };
    const beans = { name: 'Robusta Parchment', category: 'beans', variety: null, coffeeType: null };
    expect((await kaluppa.post('/api/admin/products').send(body({ ...beans, unit: 'piece' }))).body.errors.unit).toBe('Choose kg or sack');
    expect((await kaluppa.post('/api/admin/products').send(body({ ...beans, unit: 'kg' }))).status).toBe(201);
    const wrongUnit = await kaluppa.post('/api/admin/products').send(body({ ...fertilizer, unit: 'pack' }));
    expect(wrongUnit.body.errors.unit).toBe('Choose sack or kg');
    const ok = await kaluppa.post('/api/admin/products').send(body(fertilizer));
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ unit: 'sack', variety: null, coffeeType: null });
    expect(ok.body.data).not.toHaveProperty('isFeatured');
  });

  it('a new product starts above the low-stock level; editing stock is unaffected (Change 08)', async () => {
    const low = await kaluppa.post('/api/admin/products').send(body({ name: 'Low Start Roast', stock: 10 }));
    expect(low.status).toBe(400);
    expect(low.body.errors).toEqual({ stock: 'Starting stock must be more than 10, the low-stock level.' });
    const created = (await kaluppa.post('/api/admin/products').send(body({ name: 'Low Start Roast', stock: 11 })).expect(201)).body.data;
    const edited = await kaluppa.patch(`/api/admin/products/${created._id}`).send(body({ name: 'Low Start Roast', stock: 3 })).expect(200);
    expect(edited.body.data).toMatchObject({ stock: 3, stockState: 'low' });
  });

  it('a product can have no photos: the store shows the default image (Change 08)', async () => {
    const res = await kaluppa.post('/api/admin/products').send(body({ name: 'No Photo Roast', photos: [] })).expect(201);
    expect(res.body.data.photos).toEqual([]);
  });

  it('requires a variety and coffee type for coffee', async () => {
    const res = await kaluppa.post('/api/admin/products').send(body({ name: 'No Variety', variety: null, coffeeType: null }));
    expect(res.body.errors).toMatchObject({ variety: expect.any(String), coffeeType: expect.any(String) });
  });
});

describe('Inventory: list, archive, restore, audit and access', () => {
  it('lists with stock states and filters by status, category, stock and name', async () => {
    const res = await kaluppa.get('/api/admin/products?category=beans');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.slug)).toContain('liberica-dried-cherry');
    expect(res.body.data.find((p) => p.slug === 'liberica-dried-cherry')).toMatchObject({ stock: 20, stockState: 'in' });
    // Low stock is 10 or fewer, in every category.
    const ten = await Product.create({ ...(await Product.findOne({ slug: 'liberica-dried-cherry' }).lean()), _id: undefined, slug: 'ten-left', name: 'Ten Left Cherry', stock: 10 });
    expect((await kaluppa.get('/api/admin/products?stock=low')).body.data.map((p) => p.slug)).toContain(ten.slug);
    const inactive = (await kaluppa.get('/api/admin/products?status=inactive')).body.data.map((p) => p.slug);
    expect(inactive).toEqual(['hidden-old-roast']);
    const out = await Product.create({ ...(await Product.findOne({ slug: 'robusta-ground' }).lean()), _id: undefined, slug: 'sold-out', name: 'Sold Out Roast', stock: 0 });
    expect((await kaluppa.get('/api/admin/products?stock=out')).body.data.map((p) => p.slug)).toEqual([out.slug]);
    expect((await kaluppa.get('/api/admin/products?q=sold%20out')).body.data.map((p) => p.slug)).toEqual([out.slug]);
  });

  it('archives a product out of the store and restores it', async () => {
    const barako = await Product.findOne({ slug: 'barako-medium-roast' }).lean();
    const archived = await kaluppa.post(`/api/admin/products/${barako._id}/archive`);
    expect(archived.status).toBe(200);
    expect(archived.body.data.archivedAt).toEqual(expect.any(String));
    expect((await request(app).get('/api/products/barako-medium-roast')).status).toBe(404);
    expect((await request(app).get('/api/products?category=coffee&limit=24')).body.data.map((p) => p.slug)).not.toContain('barako-medium-roast');
    expect((await buyer.post('/api/cart/items').send({ productId: String(barako._id), quantity: 1 })).status).toBe(404);
    expect((await kaluppa.get('/api/admin/products')).body.data.map((p) => p.slug)).not.toContain('barako-medium-roast');
    expect((await kaluppa.get('/api/admin/products?status=archived')).body.data.map((p) => p.slug)).toEqual(['barako-medium-roast']);

    await kaluppa.post(`/api/admin/products/${barako._id}/restore`).expect(200);
    expect((await request(app).get('/api/products/barako-medium-roast')).status).toBe(200);
  });

  it('records create, update and archive in the audit log', async () => {
    const actions = (await AuditLog.find({ area: 'inventory' }).lean()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['create', 'update', 'archive', 'restore']));
    const updates = await AuditLog.find({ area: 'inventory', action: 'update' }).lean();
    expect(updates.flatMap((u) => u.changes.map((c) => c.field))).toEqual(expect.arrayContaining(['photos', 'stock']));
  });

  it('is Kaluppa’s only', async () => {
    expect((await farmer.get('/api/admin/products')).status).toBe(403);
    expect((await buyer.post('/api/admin/products').send({})).status).toBe(403);
  });
});
