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
const { seedEmail } = await import('../src/database/seeders/users.seeder.js');
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
    expect(first).toEqual({ roles: 4, permissions: 36, users: 27 });

    const byEmail = async (local) => User.findOne({ email: `kapekonek.${local}@gmail.com` }).select('+password');
    expect((await byEmail('kaluppa')).roles).toEqual(['kaluppa']);
    expect((await byEmail('manager.santacruz')).roles).toEqual(['group_manager']);
    expect((await byEmail('farmer.approved')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('farmer.unverified')).emailVerifiedAt).toBeNull();
    expect((await byEmail('buyer')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('buyer.unverified')).emailVerifiedAt).toBeNull();
    expect(await (await byEmail('buyer')).comparePassword('KapeKonek@123')).toBe(true);
    expect((await byEmail('manager.santacruz')).username).toBe('manager.santacruz');
    expect(await User.countDocuments({ isSeed: true, email: /@gmail\.com$/ })).toBe(27);
    expect(await User.exists({ username: 'buyer07', email: 'kapekonek.buyer07@gmail.com' })).toBeTruthy();
  });

  it('builds seed emails from SEED_EMAIL_BASE when it is set', () => {
    expect(seedEmail('farmer.approved', 'Carl@gmail.com')).toBe('carl+farmer.approved@gmail.com');
    expect(seedEmail('buyer', undefined)).toBe('kapekonek.buyer@gmail.com');
  });

  it('refuses unknown seeder names', async () => {
    await expect(runSeeders({ only: ['nope'], log: () => {} })).rejects.toThrow(/Unknown seeder: nope/);
  });
});

describe('associations seeder (PHASE-2-SPEC §8)', () => {
  const log = () => {};

  it('seeds 3 associations and farmers in every state, once', async () => {
    const { Association, FarmerProfile, AuditLog, Conversation, ConversationMember } = await import('../src/models/index.js');
    await runSeeders({ only: ['roles', 'users', 'associations'], log });
    const snapshot = async () => [await Association.countDocuments(), await FarmerProfile.countDocuments(), await AuditLog.countDocuments(), await User.countDocuments()];
    const first = await snapshot();
    await runSeeders({ only: ['associations'], log });
    expect(await snapshot()).toEqual(first);

    const user = (username) => User.findOne({ username }).lean();
    const id = async (username) => (await user(username))._id;
    const byName = Object.fromEntries((await Association.find().lean()).map((a) => [a.municipality, a]));
    expect(Object.keys(byName).sort()).toEqual(['Boac', 'Gasan', 'Santa Cruz']);
    expect(byName['Santa Cruz']).toMatchObject({ name: 'Santa Cruz Coffee Growers', groupManager: await id('manager.santacruz') });
    expect(byName.Boac.groupManager).toEqual(await id('manager.boac'));
    expect(byName.Gasan.groupManager ?? null).toBeNull();
    expect(Object.values(byName).every((a) => a.groupChat)).toBe(true);
    expect(await Association.exists({ groupManager: await id('manager.unassigned') })).toBeNull();

    const profile = async (username) => FarmerProfile.findOne({ user: await id(username) }).lean();
    const sc = byName['Santa Cruz']._id;
    expect(await profile('farmer.approved')).toMatchObject({ status: 'approved', association: sc, approvedBy: await id('manager.santacruz') });
    expect(await profile('farmer.pending')).toMatchObject({ status: 'pending', association: sc });
    expect(await profile('farmer.new')).toMatchObject({ status: 'none' });
    expect((await user('farmer.new')).emailVerifiedAt).not.toBeNull();
    expect(await profile('farmer.rejected')).toMatchObject({ status: 'rejected', association: sc, rejectionReason: expect.stringMatching(/.{5,}/) });
    expect(await profile('farmer.transfer')).toMatchObject({ status: 'approved', association: byName.Boac._id, transferRequest: { association: sc } });
    const nomail = await user('farmer.nomail');
    expect(nomail).toMatchObject({ mustChangePassword: true, createdBy: await id('manager.santacruz') });
    expect(nomail.email ?? null).toBeNull();
    expect(nomail.emailVerifiedAt).not.toBeNull();
    expect(await profile('farmer.nomail')).toMatchObject({ status: 'approved', association: sc });

    // manager.santacruz lands with 4 waiting (3 requests + 1 transfer in); about 14 farmers in all.
    const { countWaiting } = await import('../src/repositories/farmerProfile.repository.js');
    expect(await countWaiting(sc)).toBe(4);
    expect(await FarmerProfile.countDocuments()).toBeGreaterThanOrEqual(14);

    // Approved farmers are in their group chat; everyone has a chat with Kaluppa.
    expect(await ConversationMember.exists({ conversation: byName['Santa Cruz'].groupChat, user: await id('farmer.approved'), canPost: true })).toBeTruthy();
    expect(await Conversation.countDocuments({ type: 'kaluppa' })).toBeGreaterThanOrEqual(16);

    // Seeded decisions are audited, without documents.
    expect(await AuditLog.countDocuments({ area: 'farmers', action: { $in: ['approve', 'reject', 'request', 'transfer_request', 'create'] } })).toBeGreaterThanOrEqual(10);
    expect(await AuditLog.countDocuments({ area: 'associations', action: 'create' })).toBe(3);
    expect(JSON.stringify(await AuditLog.find().lean())).not.toMatch(/documents|validId|landProof/);
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
    const liberica = posts.find((p) => p.body.startsWith('Fresh Liberica roasts are in!'));
    expect(liberica.media[4].alt).toBe('Kraft coffee bag held in hand'); // the portrait photo e2e/media.spec.js steps to
    for (const post of posts) {
      expect(post.commentCount).toBe(await PostComment.countDocuments({ post: post._id }));
      const reactions = await Reaction.countDocuments({ targetType: 'post', target: post._id });
      expect(Object.values(post.reactionCounts).reduce((a, b) => a + b, 0)).toBe(reactions);
    }

    const reviewed = await Product.find({ ratingCount: { $gte: 12 } }).lean();
    expect(reviewed.length).toBeGreaterThanOrEqual(2);
    for (const product of reviewed) expect(product.ratingCount).toBe(await Review.countDocuments({ product: product._id }));
    expect(await Review.countDocuments({ comment: /chat|messag/i })).toBe(0);
    for (const review of await Review.find().lean()) {
      expect(await Order.exists({ _id: review.order, buyer: review.buyer, status: 'sold', 'items.product': review.product })).toBeTruthy();
    }
    const order = await Order.findOne({ status: 'sold' }).lean();
    expect(order.orderNumber).toMatch(/^KK-\d{8}-\d{4}$/);

    const juana = await User.findOne({ email: 'kapekonek.buyer@gmail.com' });
    const addresses = await Address.find({ user: juana._id }).sort({ createdAt: 1 }).lean();
    expect(addresses.map((a) => [a.label, a.isDefault, Boolean(a.location)])).toEqual([['Home', true, true], ['Work', false, true], ['Other', false, false]]);
    expect(addresses[2]).toMatchObject({ customLabel: 'Mama’s house', municipality: 'Boac', barangay: 'Caganhao', postalCode: '4900' });
    const buyer01 = await User.findOne({ email: 'kapekonek.buyer01@gmail.com' });
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
  }, 60_000); // every seeder, twice, on a shared mongod while other files run

  it('--only=settings touches settings only', async () => {
    await Product.deleteOne({ slug: 'robusta-ground' });
    await Setting.deleteOne({ key: 'delivery.eta' });
    await runSeeders({ only: ['settings'], log });
    expect(await Setting.countDocuments({ key: 'delivery.eta' })).toBe(1);
    expect(await Product.countDocuments({ slug: 'robusta-ground' })).toBe(0);
  });
});

describe('records seeder (PHASE-2-SPEC §8)', () => {
  const log = () => {};

  it('seeds farms in all 6 towns, both Kaluppa farms, every tree stage and 12 months of harvests, once', async () => {
    const { Farm, TreeGroup, Harvest, Association } = await import('../src/models/index.js');
    await runSeeders({ only: ['roles', 'users', 'associations', 'records'], log });
    const snapshot = async () => [await Farm.countDocuments(), await TreeGroup.countDocuments(), await Harvest.countDocuments()];
    const first = await snapshot();
    await runSeeders({ only: ['records'], log });
    expect(await snapshot()).toEqual(first);

    expect((await Farm.distinct('municipality')).sort()).toEqual(['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']);
    const manager = await User.findOne({ username: 'manager.santacruz' }).lean();
    const kaluppaFarms = await Farm.find({ ownerType: 'kaluppa' }).lean();
    expect(kaluppaFarms).toHaveLength(2);
    const managed = kaluppaFarms.find((f) => f.managedBy);
    expect(String(managed.managedBy)).toBe(String(manager._id));
    expect(String(managed.association)).toBe(String((await Association.findOne({ groupManager: manager._id }).lean())._id));
    expect(managed.assignedFarmers.length).toBeGreaterThan(0);
    expect(kaluppaFarms.filter((f) => !f.managedBy)).toHaveLength(1);
    expect(await Farm.countDocuments({ archivedAt: { $ne: null } })).toBeGreaterThan(0);

    expect((await TreeGroup.distinct('stage', { archivedAt: null })).sort()).toEqual(['damaged', 'flowering', 'fruiting', 'growing', 'newly_planted']);
    const months = new Set((await Harvest.find({}, 'harvestedAt').lean()).map((h) => h.harvestedAt.toISOString().slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(12);
    expect(await Harvest.countDocuments({ harvestedAt: { $gt: new Date() } })).toBe(0);
    // Every harvest's variety has trees on its farm (the rule the API enforces).
    for (const h of await Harvest.find().lean()) {
      expect(await TreeGroup.exists({ farm: h.farm, variety: h.variety })).toBeTruthy();
    }
  });
});

describe('migrate:fresh guard', () => {
  it('refuses production without --force', () => {
    expect(() => assertCanDropDatabase('production', ['--seed'])).toThrow(/Refusing/);
    expect(() => assertCanDropDatabase('production', ['--force'])).not.toThrow();
    expect(() => assertCanDropDatabase('development', [])).not.toThrow();
  });
});
