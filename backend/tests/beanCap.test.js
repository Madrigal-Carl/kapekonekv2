import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { beanBody } from './helpers/beans.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());
// A slow sum holds each transaction open, so two simultaneous listings really overlap: without the per-farmer lock
// both would sum 0 kg and both be saved.
vi.mock('../src/repositories/bean.repository.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, capUsedKg: async (...args) => { const kg = await real.capUsedKg(...args); await new Promise((r) => setTimeout(r, 150)); return kg; } };
});

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { BeanListing, FarmerProfile, User } = await import('../src/models/index.js');

let a, manager;
let joy; // unapproved: pending request to Santa Cruz
const list = (agent, userId, fields) => agent.post('/api/beans').send(beanBody(userId, fields));
const capOf = async (agent, query = '') => (await agent.get(`/api/beans/cap${query}`).expect(200)).body.data;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  a = await setUpAssociations(app, User);
  manager = await signedIn(app, 'manager.santacruz');
  joy = await registerFarmer(app, User, 'joy');
});
beforeEach(async () => {
  await BeanListing.deleteMany({});
  await FarmerProfile.updateOne({ user: joy.user._id }, { status: 'pending', association: a.santacruz.id, approvedAt: null });
});
afterAll(stopMemoryDb);

describe('the 5 kg cap (PHASE-2-SPEC §3.5)', () => {
  it('lets an unapproved farmer at 3 kg list 2 kg more, then refuses with the meter values', async () => {
    await list(joy.agent, joy.user._id, { weightKg: 3 }).expect(201);
    expect(await capOf(joy.agent)).toEqual({ capKg: 5, usedKg: 3, leftKg: 2, approved: false });
    await list(joy.agent, joy.user._id, { weightKg: 2 }).expect(201);
    const over = await list(joy.agent, joy.user._id, { weightKg: 2.5 }).expect(403);
    expect(over.body).toMatchObject({ code: 'BEAN_CAP_EXCEEDED', data: { capKg: 5, usedKg: 5, leftKg: 0 } });
    expect(over.body.errors.weightKg).toMatch(/5 kg/);
  });

  it('two simultaneous 3 kg listings from 0: one is saved, the other refused', async () => {
    const results = await Promise.all([list(joy.agent, joy.user._id, { weightKg: 3 }), list(joy.agent, joy.user._id, { weightKg: 3 })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 403]);
    expect(await BeanListing.countDocuments({ farmer: joy.user._id })).toBe(1);
  });

  it('cancelled, rejected and expired listings don’t count', async () => {
    for (const status of ['cancelled', 'rejected', 'expired']) {
      const res = await list(joy.agent, joy.user._id, { weightKg: 2 }).expect(201);
      await BeanListing.updateOne({ _id: res.body.data.id }, { status });
    }
    expect((await capOf(joy.agent)).usedKg).toBe(0);
    await list(joy.agent, joy.user._id, { weightKg: 5 }).expect(201);
  });

  it('pending, approved and completed listings count', async () => {
    for (const status of ['pending', 'approved', 'completed']) {
      const res = await list(joy.agent, joy.user._id, { weightKg: 1.5 }).expect(201);
      await BeanListing.updateOne({ _id: res.body.data.id }, { status });
    }
    expect((await capOf(joy.agent)).usedKg).toBe(4.5);
  });

  it('an approved farmer has no limit and their listings don’t count toward it', async () => {
    await FarmerProfile.updateOne({ user: joy.user._id }, { status: 'approved', approvedAt: new Date() });
    const big = await list(joy.agent, joy.user._id, { weightKg: 40 }).expect(201);
    expect(big.body.data.countsTowardCap).toBe(false);
    expect(await capOf(joy.agent)).toMatchObject({ approved: true, usedKg: 0 });
  });

  it('after removal new listings count again; listings made while approved keep their flag (Review Focus 4)', async () => {
    await FarmerProfile.updateOne({ user: joy.user._id }, { status: 'approved', approvedAt: new Date() });
    await list(joy.agent, joy.user._id, { weightKg: 40 }).expect(201);
    await FarmerProfile.updateOne({ user: joy.user._id }, { status: 'none', association: null, approvedAt: null });
    const after = await list(joy.agent, joy.user._id, { weightKg: 4 }).expect(201);
    expect(after.body.data.countsTowardCap).toBe(true);
    expect(await capOf(joy.agent)).toMatchObject({ approved: false, usedKg: 4, leftKg: 1 });
    expect(await BeanListing.countDocuments({ farmer: joy.user._id, countsTowardCap: false })).toBe(1);
  });

  it('a Group Manager listing for an unapproved farmer uses that farmer’s cap', async () => {
    await list(joy.agent, joy.user._id, { weightKg: 4 }).expect(201);
    const managerId = (await User.findOne({ username: 'manager.santacruz' }))._id;
    expect(await capOf(manager, `?farmerId=${joy.user._id}`)).toMatchObject({ usedKg: 4, leftKg: 1 });
    const over = await list(manager, managerId, { farmerId: String(joy.user._id), weightKg: 1.5 }).expect(403);
    expect(over.body.data).toEqual({ capKg: 5, usedKg: 4, leftKg: 1 });
    await list(manager, managerId, { farmerId: String(joy.user._id), weightKg: 1 }).expect(201);
  });

  it('an edit re-checks the cap without counting the listing twice', async () => {
    const first = await list(joy.agent, joy.user._id, { weightKg: 2 }).expect(201);
    await list(joy.agent, joy.user._id, { weightKg: 2 }).expect(201);
    await joy.agent.patch(`/api/beans/${first.body.data.id}`).send(beanBody(joy.user._id, { weightKg: 3 })).expect(200);
    const over = await joy.agent.patch(`/api/beans/${first.body.data.id}`).send(beanBody(joy.user._id, { weightKg: 3.5 })).expect(403);
    expect(over.body.data).toEqual({ capKg: 5, usedKg: 5, leftKg: 0 });
  });
});
