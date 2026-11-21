import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
// Seeds use the remote media URLs as-is: no network, no Cloudinary.
vi.mock('../src/database/seeders/media.js', async (importOriginal) => {
  const original = await importOriginal();
  const { createRequire } = await import('node:module');
  const media = createRequire(import.meta.url)('../src/database/seeders/data/media.json');
  const map = Object.fromEntries(media.map((m) => [m.key, { type: m.type, url: m.url, publicId: null, alt: m.alt, posterUrl: m.posterUrl, durationSec: 13 }]));
  return { ...original, seedMedia: async () => map };
});

const { runSeeders } = await import('../src/database/seeders/index.js');
const { assertCanDropDatabase } = await import('../src/database/commands/migrateFresh.js');
const { User, Role, Permission, Category, Product, Setting, Post, PostComment, Reaction, Order, Review, Address, Notification } = await import('../src/models/index.js');
const { ORDER_STATUSES } = await import('../src/constants/orderStatus.js');

beforeAll(startMemoryDb);
afterAll(stopMemoryDb);

const counts = async () => ({ roles: await Role.countDocuments(), permissions: await Permission.countDocuments(), users: await User.countDocuments() });
const allCounts = async () => Object.fromEntries(await Promise.all(
  Object.entries({ Category, Product, Setting, Post, PostComment, Reaction, Order, Review, Address, Notification }).map(async ([name, model]) => [name, await model.countDocuments()]),
));

describe('runSeeders', () => {
  it('is idempotent and creates the demo accounts', async () => {
    const log = () => {};
    await runSeeders({ only: ['roles', 'users'], log });
    const first = await counts();
    await runSeeders({ only: ['roles', 'users'], log });
    expect(await counts()).toEqual(first);
    expect(first).toEqual({ roles: 4, permissions: 17, users: 26 });

    const byEmail = async (local) => User.findOne({ email: `${local}@kapekonek.test` }).select('+password');
    expect((await byEmail('kaluppa')).roles).toEqual(['kaluppa']);
    expect((await byEmail('manager')).roles).toEqual(['group_manager']);
    expect((await byEmail('farmer1')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('farmer2')).emailVerifiedAt).toBeNull();
    expect((await byEmail('buyer')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('buyer.unverified')).emailVerifiedAt).toBeNull();
    expect(await (await byEmail('buyer')).comparePassword('Password123!')).toBe(true);
  });

  it('refuses unknown seeder names', async () => {
    await expect(runSeeders({ only: ['nope'], log: () => {} })).rejects.toThrow(/Unknown seeder: nope/);
  });
});

describe('catalog, settings, posts and demo seeders', () => {
  const log = () => {};

  it('seeds the catalog, settings, posts and demo activity once', async () => {
    await runSeeders({ log });
    const first = await allCounts();
    expect(first).toMatchObject({ Category: 3, Product: 21, Setting: 5, Post: 8 });
    expect(first.Order).toBeGreaterThanOrEqual(20);

    const bySlug = async (slug) => (await Category.findOne({ slug })).toObject();
    const coffee = await bySlug('coffee');
    expect(coffee).toMatchObject({ isPublic: true, purchasePermission: 'catalog.coffee' });
    expect((await bySlug('fertilizer')).isPublic).toBe(false);
    const coffeeProducts = await Product.find({ category: coffee._id }).lean();
    expect(coffeeProducts).toHaveLength(12);
    expect(coffeeProducts.filter((p) => p.stock === 0)).toHaveLength(1);
    expect(coffeeProducts.filter((p) => p.stock > 0 && p.stock <= 5).length).toBeGreaterThanOrEqual(1);
    expect(coffeeProducts.filter((p) => p.isFeatured).length).toBeGreaterThanOrEqual(4);
    expect(coffeeProducts.every((p) => p.images.length >= 1 && p.images[0].url.startsWith('https://'))).toBe(true);

    const slides = (await Setting.findOne({ key: 'landing.heroSlides' })).value;
    expect(slides).toHaveLength(3);
    expect(slides[0]).toMatchObject({ title: expect.any(String), image: { url: expect.stringMatching(/^https:/) }, ctaHref: expect.stringMatching(/^\//) });

    const posts = await Post.find().lean();
    expect(posts.some((p) => p.media.length === 0)).toBe(true);
    expect(posts.some((p) => p.media.filter((m) => m.type === 'image').length > 1)).toBe(true);
    expect(posts.some((p) => p.media.some((m) => m.type === 'video'))).toBe(true);
    for (const post of posts) {
      expect(post.commentCount).toBe(await PostComment.countDocuments({ post: post._id }));
      const reactions = await Reaction.countDocuments({ targetType: 'post', target: post._id });
      expect(Object.values(post.reactionCounts).reduce((a, b) => a + b, 0)).toBe(reactions);
    }

    const reviewed = await Product.find({ ratingCount: { $gte: 12 } }).lean();
    expect(reviewed.length).toBeGreaterThanOrEqual(2);
    for (const product of reviewed) expect(product.ratingCount).toBe(await Review.countDocuments({ product: product._id }));
    expect(await Review.countDocuments({ comment: /chat|messag/i })).toBe(0);
    const order = await Order.findOne({ status: 'sold' }).lean();
    expect(order.orderNumber).toMatch(/^KK-\d{8}-\d{4}$/);

    const juana = await User.findOne({ email: 'buyer@kapekonek.test' });
    const addresses = await Address.find({ user: juana._id }).sort({ createdAt: 1 }).lean();
    expect(addresses.map((a) => [a.label, a.isDefault, Boolean(a.location)])).toEqual([['Home', true, true], ['Work', false, true], ['Other', false, false]]);
    expect(addresses[2]).toMatchObject({ customLabel: 'Mama’s house', municipality: 'Boac', barangay: 'Caganhao', postalCode: '4900' });
    const buyer01 = await User.findOne({ email: 'buyer01@kapekonek.test' });
    expect(await Address.countDocuments({ user: buyer01._id })).toBe(1);

    const mine = await Order.find({ buyer: juana._id }).lean();
    expect(mine.length).toBeGreaterThanOrEqual(15);
    expect(new Set(mine.map((o) => o.status))).toEqual(new Set(ORDER_STATUSES));
    expect(new Set(mine.map((o) => `${o.fulfillment.method}/${o.payment.method}`)).size).toBe(4);
    expect(mine.filter((o) => o.refund.status === 'refunded')).toHaveLength(1);
    expect(mine.filter((o) => o.refund.status === 'pending').length).toBeGreaterThanOrEqual(1);
    expect(mine.find((o) => o.status === 'out_for_delivery').fulfillment.rider.name).toBeTruthy();
    for (const o of mine.filter((x) => ['reserved', 'processing', 'out_for_delivery', 'ready_for_pickup'].includes(x.status))) {
      expect(o.fulfillment.etaFrom).toBeTruthy();
      expect(o.statusHistory.map((h) => h.status)).toContain('reserved');
    }
    for (const o of mine.filter((x) => x.status === 'pending')) expect(Date.now() - o.createdAt.getTime()).toBeLessThan(2 * 86_400_000);
    for (const o of mine.filter((x) => x.fulfillment.method === 'delivery')) expect(o.deliveryFeeCentavos).toBeGreaterThanOrEqual(5000);
    expect(await Notification.countDocuments({ user: juana._id })).toBeGreaterThanOrEqual(mine.length - 1);
    expect(await Notification.countDocuments({ title: /undefined/ })).toBe(0);

    await runSeeders({ log });
    expect(await allCounts()).toEqual(first);
  });

  it('--only=settings touches settings only', async () => {
    await Product.deleteOne({ slug: 'robusta-ground' });
    await Setting.deleteOne({ key: 'delivery.eta' });
    await runSeeders({ only: ['settings'], log });
    expect(await Setting.countDocuments({ key: 'delivery.eta' })).toBe(1);
    expect(await Product.countDocuments({ slug: 'robusta-ground' })).toBe(0);
  });
});

describe('migrate:fresh guard', () => {
  it('refuses production without --force', () => {
    expect(() => assertCanDropDatabase('production', ['--seed'])).toThrow(/Refusing/);
    expect(() => assertCanDropDatabase('production', ['--force'])).not.toThrow();
    expect(() => assertCanDropDatabase('development', [])).not.toThrow();
  });
});
