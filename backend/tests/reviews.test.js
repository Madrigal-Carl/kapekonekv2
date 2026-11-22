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
const { Order, Product, Review } = await import('../src/models/index.js');

async function signedIn(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: email, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let products;
let buyer;
let other;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  buyer = await signedIn('kapekonek.buyer@gmail.com');
  other = await signedIn('kapekonek.buyer01@gmail.com');
});
afterAll(stopMemoryDb);

const barako = () => products['barako-medium-roast'];
const reviewsUrl = () => `/api/products/${barako()._id}/reviews`;

describe('writing reviews', () => {
  it('needs a sign-in and a verified email', async () => {
    expect((await request(app).post(reviewsUrl()).send({ rating: 5, comment: 'Great coffee indeed.' })).status).toBe(401);
    const unverified = await signedIn('kapekonek.buyer.unverified@gmail.com');
    const res = await unverified.post(reviewsUrl()).send({ rating: 5, comment: 'Great coffee indeed.' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('refuses a buyer without a sold order of the product', async () => {
    const res = await buyer.post(reviewsUrl()).send({ rating: 5, comment: 'Great coffee indeed.' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('REVIEW_NOT_ALLOWED');
    const me = await buyer.get(`${reviewsUrl()}/me`);
    expect(me.body.data).toEqual({ review: null, canReview: false, reason: 'not_purchased', order: null, pendingOrderNumber: null, pendingOrderId: null });
  });

  it('says when an order of it is still on its way, and links that order', async () => {
    const open = await createSoldOrder('kapekonek.buyer@gmail.com', barako(), { number: '0900' });
    await Order.updateOne({ _id: open._id }, { status: 'confirmed' });
    const me = (await buyer.get(`${reviewsUrl()}/me`)).body.data;
    expect(me).toMatchObject({ canReview: false, reason: 'not_completed', pendingOrderNumber: 'KK-20261101-0900', pendingOrderId: String(open._id) });
    expect((await buyer.post(reviewsUrl()).send({ rating: 5, comment: 'Great coffee indeed.' })).body.code).toBe('REVIEW_NOT_ALLOWED');
    await Order.deleteOne({ _id: open._id });
  });

  it('validates rating and comment length', async () => {
    const res = await buyer.post(reviewsUrl()).send({ rating: 6, comment: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['comment', 'rating']);
  });

  it('accepts one review after a sold order and recomputes the rating', async () => {
    await createSoldOrder('kapekonek.buyer@gmail.com', barako(), { number: '0001' });
    const me = await buyer.get(`${reviewsUrl()}/me`);
    expect(me.body.data).toMatchObject({ review: null, canReview: true, order: { orderNumber: 'KK-20261101-0001', method: 'pickup', soldAt: '2026-11-08T02:00:00.000Z' } });

    const res = await buyer.post(reviewsUrl()).send({ rating: 4, comment: 'Bold and smoky, just right.' });
    expect(res.status).toBe(201);
    expect((await Product.findById(barako()._id)).toObject()).toMatchObject({ ratingAverage: 4, ratingCount: 1 });

    const again = await buyer.post(reviewsUrl()).send({ rating: 5, comment: 'Second try at this one.' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('ALREADY_REVIEWED');
    expect((await buyer.get(`${reviewsUrl()}/me`)).body.data).toMatchObject({ canReview: false, reason: 'already_reviewed', review: { rating: 4 } });

    await createSoldOrder('kapekonek.buyer01@gmail.com', barako(), { number: '0002', method: 'delivery' });
    await other.post(reviewsUrl()).send({ rating: 5, comment: 'Smells amazing when brewed.' }).expect(201);
    expect((await Product.findById(barako()._id)).toObject()).toMatchObject({ ratingAverage: 4.5, ratingCount: 2 });
  });

  it('lets only the author edit, and recomputes with one decimal', async () => {
    const mine = (await buyer.get(`${reviewsUrl()}/me`)).body.data.review;
    expect((await other.patch(`/api/reviews/${mine._id}`).send({ rating: 1 })).status).toBe(404);

    const res = await buyer.patch(`/api/reviews/${mine._id}`).send({ rating: 2, comment: 'Changed my mind after a week.' });
    expect(res.status).toBe(200);
    expect(res.body.data.editedAt).not.toBeNull();
    expect((await Product.findById(barako()._id)).toObject()).toMatchObject({ ratingAverage: 3.5, ratingCount: 2 });
  });

});

describe('reading reviews', () => {
  it('lists newest first with the reviewer and how they got it', async () => {
    const res = await request(app).get(reviewsUrl());
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.rating)).toEqual([5, 2]);
    expect(res.body.data[0]).toMatchObject({ author: { name: expect.stringMatching(/^\w+ \w\.$/), initials: expect.any(String) }, fulfillment: 'delivery' });
    expect(res.body.data[1]).toMatchObject({ author: { name: 'Juana D.' }, fulfillment: 'pickup' });
    expect(res.body.data[0].buyer).toBeUndefined();
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('summarises the distribution', async () => {
    const res = await request(app).get(`${reviewsUrl()}/summary`);
    expect(res.body.data).toEqual({ average: 3.5, count: 2, distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 1 } });
  });

  it('404s for an unknown product', async () => {
    expect((await request(app).get('/api/products/64b000000000000000000000/reviews')).status).toBe(404);
  });
});

describe('removing your review', () => {
  it('lets only the author delete, recomputes, and lets them review again', async () => {
    const mine = (await buyer.get(`${reviewsUrl()}/me`)).body.data.review;
    expect((await request(app).delete(`/api/reviews/${mine._id}`)).status).toBe(401);
    expect((await other.delete(`/api/reviews/${mine._id}`)).status).toBe(404);
    expect(await Review.countDocuments({ _id: mine._id })).toBe(1);

    await buyer.delete(`/api/reviews/${mine._id}`).expect(200);
    expect(await Review.countDocuments({ _id: mine._id })).toBe(0);
    expect((await Product.findById(barako()._id)).toObject()).toMatchObject({ ratingAverage: 5, ratingCount: 1 });
    expect((await buyer.get(`${reviewsUrl()}/me`)).body.data).toMatchObject({ review: null, canReview: true, reason: null });
    expect((await buyer.delete(`/api/reviews/${mine._id}`)).status).toBe(404);
  });

  it('keeps farmers out until the farmer shop ships', async () => {
    const farmer = await signedIn('kapekonek.farmer.approved@gmail.com');
    expect((await farmer.post(reviewsUrl()).send({ rating: 5, comment: 'Great coffee indeed.' })).status).toBe(403);
    expect((await farmer.delete('/api/reviews/5f0000000000000000000000')).status).toBe(403);
  });
});
