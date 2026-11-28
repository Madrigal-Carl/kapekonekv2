import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { beanBody } from './helpers/beans.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations } from './helpers/farmers.js';

const mail = vi.hoisted(() => []);
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }) }));
vi.mock('../src/clients/cloudinary.client.js', async () => (await import('./helpers/beans.js')).cloudinaryMock());

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, BeanListing, FarmerProfile, Notification, User } = await import('../src/models/index.js');
const { JOBS } = await import('../src/queues/jobs.queue.js');
const { processJob } = await import('../src/queues/workers/jobs.worker.js');

const HOUR = 3_600_000;

describe('beans:expire (PHASE-2-SPEC §3.5)', () => {
  let ana, ids;
  beforeAll(async () => {
    await startMemoryDb();
    await runSeeders({ only: ['roles', 'users', 'settings'], log: () => {} });
    const a = await setUpAssociations(app, User);
    ana = await registerFarmer(app, User, 'ana');
    await FarmerProfile.updateOne({ user: ana.user._id }, { status: 'approved', association: a.santacruz.id, approvedAt: new Date() });
    const make = async (status, expiresIn) => {
      const { id } = (await ana.agent.post('/api/beans').send(beanBody(ana.user._id)).expect(201)).body.data;
      await BeanListing.updateOne({ _id: id }, { status, expiresAt: expiresIn == null ? null : new Date(Date.now() + expiresIn) });
      return id;
    };
    ids = { overdue: await make('approved', -HOUR), due: await make('approved', HOUR), pending: await make('pending', -HOUR), done: await make('completed', -HOUR) };
  });
  afterAll(stopMemoryDb);

  it('expires only approved listings past expiresAt, as the system, and tells the farmer', async () => {
    expect(await processJob({ name: JOBS.BEANS_EXPIRE })).toEqual({ expired: 1 });
    const statuses = Object.fromEntries(await Promise.all(Object.entries(ids).map(async ([k, id]) => [k, (await BeanListing.findById(id).lean()).status])));
    expect(statuses).toEqual({ overdue: 'expired', due: 'approved', pending: 'pending', done: 'completed' });
    const overdue = await BeanListing.findById(ids.overdue).lean();
    expect(overdue.history.at(-1)).toMatchObject({ action: 'expired', by: null, byRole: 'system' });
    const entry = await AuditLog.findOne({ area: 'beans', action: 'expire' }).lean();
    expect(entry).toMatchObject({ actor: null, actorRole: 'system' });
    expect(await Notification.countDocuments({ user: ana.user._id, type: 'bean_status', 'data.listingId': ids.overdue })).toBe(1);
    expect(mail.filter((m) => m.data.status === 'expired')).toHaveLength(1);
  });

  it('running it again changes nothing', async () => {
    expect(await processJob({ name: JOBS.BEANS_EXPIRE })).toEqual({ expired: 0 });
    expect(await AuditLog.countDocuments({ area: 'beans', action: 'expire' })).toBe(1);
  });

  it('refuses an unknown job', async () => {
    await expect(processJob({ name: 'nope' })).rejects.toThrow('Unknown job: nope');
  });
});
