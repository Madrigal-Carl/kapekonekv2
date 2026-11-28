import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createSoldOrder, seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, Notification, Product, User } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

const BUYER = 'kapekonek.buyer@gmail.com';
const OTHER = 'kapekonek.buyer01@gmail.com';
let products;
let kaluppa;
let buyer;
let five; // buyer's 5-star review
let two; // other buyer's 2-star review
const barako = () => products['barako-medium-roast'];
const rating = async () => (await Product.findById(barako()._id).lean());

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  kaluppa = await signedIn('kapekonek.kaluppa@gmail.com');
  buyer = await signedIn(BUYER);
  const other = await signedIn(OTHER);
  await createSoldOrder(BUYER, barako(), { number: '0001' });
  await createSoldOrder(OTHER, barako(), { number: '0002' });
  five = (await buyer.post(`/api/products/${barako()._id}/reviews`).send({ rating: 5, comment: 'Chocolatey and smooth every morning.' })).body.data;
  two = (await other.post(`/api/products/${barako()._id}/reviews`).send({ rating: 2, comment: 'Call me at 0917 000 0000 for a deal.' })).body.data;
});
afterAll(stopMemoryDb);

describe('GET /admin/reviews', () => {
  it('lists every review with product, reviewer type, reply and visibility, filterable', async () => {
    const res = await kaluppa.get('/api/admin/reviews');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 2 });
    expect(res.body.data[0]).toMatchObject({
      id: expect.any(String), rating: 2, product: { name: 'Barako Medium Roast' }, reviewer: { role: 'buyer', name: expect.any(String) },
      reply: null, hidden: null,
    });
    expect((await kaluppa.get('/api/admin/reviews?rating=5')).body.data.map((r) => r.id)).toEqual([five._id]);
    expect((await kaluppa.get('/api/admin/reviews?q=chocolatey')).body.data.map((r) => r.id)).toEqual([five._id]);
    expect((await kaluppa.get(`/api/admin/reviews?product=${barako()._id}`)).body.meta.total).toBe(2);
    expect((await kaluppa.get('/api/admin/reviews/products')).body.data).toEqual([{ id: String(barako()._id), name: 'Barako Medium Roast' }]);
  });

  it('is closed to the reviewer and other roles', async () => {
    expect((await buyer.get('/api/admin/reviews')).status).toBe(403);
    expect((await buyer.put(`/api/admin/reviews/${five._id}/reply`).send({ body: 'Thanks!' })).status).toBe(403);
    expect((await buyer.post(`/api/admin/reviews/${two._id}/hide`).send({ reason: 'I do not like it' })).status).toBe(403);
  });
});

describe('Replies', () => {
  it('badges the reviews that need a reply', async () => {
    expect((await kaluppa.get('/api/dashboard/badges')).body.data.reviews).toBe(2);
  });

  it('keeps one reply per review: PUT creates then edits it, the reviewer is told once, and it shows on the product page', async () => {
    const first = await kaluppa.put(`/api/admin/reviews/${five._id}/reply`).send({ body: 'Thank you, Marites!' });
    expect(first.status).toBe(200);
    expect(first.body.data.reply).toMatchObject({ body: 'Thank you, Marites!', by: { firstName: expect.any(String) }, editedAt: null });
    const edited = await kaluppa.put(`/api/admin/reviews/${five._id}/reply`).send({ body: 'Thank you so much, Marites!' });
    expect(edited.body.data.reply).toMatchObject({ body: 'Thank you so much, Marites!', at: first.body.data.reply.at, editedAt: expect.any(String) });

    const reviewer = await User.findOne({ email: BUYER }).lean();
    expect(await Notification.countDocuments({ user: reviewer._id, type: 'review_activity' })).toBe(1);
    const page = (await request(app).get(`/api/products/${barako()._id}/reviews`)).body.data;
    expect(page.find((r) => r._id === five._id).reply).toMatchObject({ body: 'Thank you so much, Marites!' });
    expect((await kaluppa.get('/api/dashboard/badges')).body.data.reviews).toBe(1);
    expect((await kaluppa.get('/api/admin/reviews?reply=replied')).body.data.map((r) => r.id)).toEqual([five._id]);
  });

  it('deletes the reply', async () => {
    const res = await kaluppa.delete(`/api/admin/reviews/${five._id}/reply`);
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBeNull();
    expect((await kaluppa.get('/api/admin/reviews?reply=needs')).body.meta.total).toBe(2);
  });

  it('validates the reply length', async () => {
    const res = await kaluppa.put(`/api/admin/reviews/${five._id}/reply`).send({ body: 'x'.repeat(1001) });
    expect(res.body.errors.body).toBe('Use 1,000 characters or fewer');
  });
});

describe('Hide and show', () => {
  it('hides with a reason: off the product page, out of the rating, reviewer notified', async () => {
    expect(await rating()).toMatchObject({ ratingAverage: 3.5, ratingCount: 2 });
    const res = await kaluppa.post(`/api/admin/reviews/${two._id}/hide`).send({ reason: 'Contains a phone number' });
    expect(res.status).toBe(200);
    expect(res.body.data.hidden).toMatchObject({ reason: 'Contains a phone number', at: expect.any(String), by: { name: expect.any(String) } });
    expect(await rating()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
    const page = (await request(app).get(`/api/products/${barako()._id}/reviews`)).body.data.map((r) => r._id);
    expect(page).toEqual([five._id]);
    expect((await request(app).get(`/api/products/${barako()._id}/reviews/summary`)).body.data).toMatchObject({ count: 1, average: 5 });
    const reviewer = await User.findOne({ email: OTHER }).lean();
    const note = await Notification.findOne({ user: reviewer._id, type: 'review_activity' }).lean();
    expect(note.body).toContain('Contains a phone number');
    expect((await kaluppa.get('/api/admin/reviews?status=hidden')).body.data.map((r) => r.id)).toEqual([two._id]);
  });

  it('needs a reason to hide', async () => {
    expect((await kaluppa.post(`/api/admin/reviews/${five._id}/hide`).send({ reason: '' })).body.errors.reason).toEqual(expect.any(String));
  });

  it('shows it again and counts it back', async () => {
    const res = await kaluppa.post(`/api/admin/reviews/${two._id}/unhide`);
    expect(res.body.data.hidden).toBeNull();
    expect(await rating()).toMatchObject({ ratingAverage: 3.5, ratingCount: 2 });
  });

  it('audits replies, hides and shows', async () => {
    const actions = (await AuditLog.find({ area: 'reviews' }).lean()).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['reply', 'update_reply', 'delete_reply', 'hide', 'unhide']));
  });

  it('gives the detail with the order link', async () => {
    const res = await kaluppa.get(`/api/admin/reviews/${five._id}`);
    expect(res.body.data).toMatchObject({ order: { orderNumber: 'KK-20261101-0001' }, product: { slug: 'barako-medium-roast' }, comment: expect.any(String) });
  });
});
