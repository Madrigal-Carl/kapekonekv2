import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { beanBody, photosOf } from './helpers/beans.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, BeanListing, FarmerProfile, Setting, User } = await import('../src/models/index.js');

const YYMM = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: '2-digit', month: '2-digit' }).format(new Date()).replace('-', '');
let a, kaluppa, manager, boacManager, managerId;
let ana, ben, joy;

async function farmerIn(username, association, status = 'approved') {
  const f = await registerFarmer(app, User, username);
  if (association) await FarmerProfile.updateOne({ user: f.user._id }, { status, association: association.id, approvedAt: status === 'approved' ? new Date() : null });
  return f;
}
const listOf = async (agent, query = '') => (await agent.get(`/api/beans${query}`).expect(200)).body;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users', 'settings'], log: () => {} });
  a = await setUpAssociations(app, User);
  kaluppa = a.kaluppa;
  manager = await signedIn(app, 'manager.santacruz');
  boacManager = await signedIn(app, 'manager.unassigned');
  managerId = (await User.findOne({ username: 'manager.santacruz' }))._id;
  ana = await farmerIn('ana', a.santacruz);
  ben = await farmerIn('ben', a.boac);
  joy = await farmerIn('joy', a.santacruz, 'pending');
});
afterAll(stopMemoryDb);

describe('POST /beans', () => {
  it('lists beans as BN-YYMM-NNNN, pending, with the association snapshot, and audits it', async () => {
    const res = await ana.agent.post('/api/beans').send(beanBody(ana.user._id)).expect(201);
    expect(res.body.message).toBe('Listing sent. Kaluppa will review it soon.');
    expect(res.body.data).toMatchObject({
      listingNumber: `BN-${YYMM}-0001`, status: 'pending', variety: 'liberica', form: 'dried_cherry', weightKg: 2,
      pricePerKgCentavos: 18_000, amountCentavos: 36_000, countsTowardCap: false,
      farmer: { name: 'Ana Farmer' }, association: { name: 'Santa Cruz Growers' }, recordedBy: { name: 'Ana Farmer' },
      canEdit: true, history: [{ action: 'listed', by: { name: 'Ana Farmer' } }],
    });
    expect(res.body.data.photos).toHaveLength(2);
    const second = await ana.agent.post('/api/beans').send(beanBody(ana.user._id)).expect(201);
    expect(second.body.data.listingNumber).toBe(`BN-${YYMM}-0002`);
    const entry = await AuditLog.findOne({ area: 'beans', action: 'create' }).lean();
    expect(entry.changes.map((c) => c.field)).toEqual(expect.arrayContaining(['weightKg', 'pricePerKgCentavos']));
    expect(JSON.stringify(entry.changes)).not.toContain('cloudinary');
  });

  it('checks weight, price, photos and note (PHASE-2-SPEC §7)', async () => {
    const bad = await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { weightKg: 1.2, pricePerKgCentavos: 50, photos: [], note: 'x'.repeat(501) })).expect(400);
    expect(Object.keys(bad.body.errors).sort()).toEqual(['note', 'photos', 'pricePerKgCentavos', 'weightKg']);
    await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { photos: photosOf(ana.user._id, 6) })).expect(400);
    await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { weightKg: 10_000.5 })).expect(400);
    await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { form: 'roasted' })).expect(400);
  });

  it('only takes photos from the uploader’s own bean_photo folder', async () => {
    const res = await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { photos: photosOf(ben.user._id, 1) })).expect(400);
    expect(res.body.errors.photos).toBe('Upload these photos again.');
  });

  it('a Group Manager lists for a farmer of its association (pending or approved), with its own uploads', async () => {
    const forJoy = await manager.post('/api/beans').send(beanBody(managerId, { farmerId: String(joy.user._id), weightKg: 1 })).expect(201);
    expect(forJoy.body.data).toMatchObject({ farmer: { name: 'Joy Farmer' }, recordedBy: { name: 'Liza Ramos' }, countsTowardCap: true, association: { name: 'Santa Cruz Growers' } });
    await manager.post('/api/beans').send(beanBody(managerId, { farmerId: String(ana.user._id) })).expect(201);
  });

  it('a Group Manager must name the farmer, and another association’s farmer is a 404', async () => {
    const missing = await manager.post('/api/beans').send(beanBody(managerId)).expect(400);
    expect(missing.body.errors.farmerId).toBeTruthy();
    await manager.post('/api/beans').send(beanBody(managerId, { farmerId: String(ben.user._id) })).expect(404);
  });

  it('Kaluppa doesn’t sell beans to itself', async () => {
    await kaluppa.post('/api/beans').send(beanBody(managerId)).expect(403);
  });
});

describe('GET /beans', () => {
  it('scopes by policy: the farmer’s own, the association’s for its Group Manager, all for Kaluppa', async () => {
    await ben.agent.post('/api/beans').send(beanBody(ben.user._id, { variety: 'robusta' })).expect(201);
    const mine = await listOf(ana.agent);
    expect(new Set(mine.data.map((l) => l.farmer.name))).toEqual(new Set(['Ana Farmer']));
    const santacruz = await listOf(manager);
    expect(new Set(santacruz.data.map((l) => l.farmer.name))).toEqual(new Set(['Ana Farmer', 'Joy Farmer']));
    expect((await listOf(boacManager)).data.map((l) => l.farmer.name)).toEqual(['Ben Farmer']);
    const all = await listOf(kaluppa);
    expect(all.meta.total).toBe(santacruz.meta.total + 1);
  });

  it('filters by status group, variety and form, and searches listing number, variety or farmer', async () => {
    const one = (await listOf(kaluppa, '?variety=robusta')).data;
    expect(one.map((l) => l.farmer.name)).toEqual(['Ben Farmer']);
    await BeanListing.updateOne({ _id: one[0].id }, { status: 'expired' });
    expect((await listOf(kaluppa, '?status=closed')).data.map((l) => l.id)).toEqual([one[0].id]);
    expect((await listOf(kaluppa, '?status=pending')).data.every((l) => l.status === 'pending')).toBe(true);
    expect((await listOf(kaluppa, '?form=parchment')).meta.total).toBe(0);
    expect((await listOf(kaluppa, '?q=ben')).data.map((l) => l.id)).toEqual([one[0].id]);
    expect((await listOf(kaluppa, '?q=Robusta')).data.map((l) => l.id)).toEqual([one[0].id]);
    expect((await listOf(kaluppa, `?q=${one[0].listingNumber}`)).meta.total).toBe(1);
  });

  it('a listing outside the scope is a 404', async () => {
    const bens = (await listOf(ben.agent)).data[0];
    await ana.agent.get(`/api/beans/${bens.id}`).expect(404);
    await manager.get(`/api/beans/${bens.id}`).expect(404);
    await kaluppa.get(`/api/beans/${bens.id}`).expect(200);
  });
});

describe('PATCH /beans/:id', () => {
  it('edits only while pending, by the farmer or their Group Manager', async () => {
    const listing = (await ana.agent.post('/api/beans').send(beanBody(ana.user._id)).expect(201)).body.data;
    // The Group Manager keeps the farmer's photos as they are and edits the rest.
    const edited = await manager.patch(`/api/beans/${listing.id}`).send(beanBody(managerId, { photos: listing.photos, weightKg: 3, note: 'Weighed again' })).expect(200);
    expect(edited.body.data).toMatchObject({ weightKg: 3, amountCentavos: 54_000, note: 'Weighed again' });
    await kaluppa.patch(`/api/beans/${listing.id}`).send(beanBody(managerId)).expect(403);
    await BeanListing.updateOne({ _id: listing.id }, { status: 'approved' });
    const late = await ana.agent.patch(`/api/beans/${listing.id}`).send(beanBody(ana.user._id)).expect(409);
    expect(late.body.message).toBe('Only listings waiting for review can be edited.');
    expect((await ana.agent.get(`/api/beans/${listing.id}`).expect(200)).body.data.canEdit).toBe(false);
  });
});

describe('branch setting (PHASE-2-SPEC §3.13, q7)', () => {
  it('replaces pickup.location: pickup orders read it, the storefront shows it', async () => {
    const info = (await kaluppa.get('/api/delivery/info').expect(200)).body.data.pickup;
    expect(info).toMatchObject({ name: 'Kaluppa', address: 'Pantayin, Santa Cruz, Marinduque', hours: 'Mon–Sat, 8:00 AM – 5:00 PM', phone: '0917 800 1122' });
    expect(await Setting.countDocuments({ key: 'pickup.location' })).toBe(0);
    const branch = (await Setting.findOne({ key: 'branch' }).lean()).value;
    await Setting.updateOne({ key: 'branch' }, { value: { ...branch, street: 'Km 3', hours: branch.hours.map((h, i) => (i === 5 ? { ...h, to: '12:00' } : h)) } });
    const changed = (await kaluppa.get('/api/delivery/info').expect(200)).body.data.pickup;
    expect(changed).toMatchObject({ address: 'Km 3, Pantayin, Santa Cruz, Marinduque', hours: 'Mon–Fri, 8:00 AM – 5:00 PM · Sat, 8:00 AM – 12:00 PM' });
  });
});

describe('Kaluppa page tiles (BeansKaluppa.dc.html)', () => {
  it('counts what waits for review and drop-off, what was bought this month and the average price', async () => {
    await BeanListing.deleteMany({});
    const make = async (weightKg, pricePerKgCentavos, set = {}) => {
      const { id } = (await ana.agent.post('/api/beans').send(beanBody(ana.user._id, { weightKg, pricePerKgCentavos })).expect(201)).body.data;
      await BeanListing.updateOne({ _id: id }, set);
    };
    const soon = new Date(Date.now() + 86_400_000);
    await make(2, 18_000);
    await make(4, 18_000);
    await make(30, 32_000, { status: 'approved', expiresAt: soon });
    await make(10, 20_000, { status: 'approved', expiresAt: new Date(Date.now() + 5 * 86_400_000) });
    await make(20, 25_000, { status: 'completed', completion: { finalWeightKg: 19.5, finalAmountCentavos: 487_500, at: new Date() } });
    await make(5, 30_000, { status: 'completed', completion: { finalWeightKg: 5, finalAmountCentavos: 150_000, at: new Date(Date.now() - 60 * 86_400_000) } });
    const { meta } = await listOf(kaluppa);
    expect(meta.tiles).toEqual({
      toReview: { count: 2, kg: 6 },
      waiting: { count: 2, kg: 40, nextExpiresAt: soon.toISOString() },
      boughtThisMonth: { kg: 19.5, paidCentavos: 487_500 },
      averagePriceCentavos: 25_000, // completed in the last 30 days: ₱4,875 / 19.5 kg
    });
    expect((await listOf(ana.agent)).meta.tiles).toBeUndefined();
  });
});
