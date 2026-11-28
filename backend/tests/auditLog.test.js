import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { beanBody } from './helpers/beans.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { documentsOf, registerFarmer } from './helpers/farmers.js';
import { dayKey, farmBody, setUpRecords } from './helpers/records.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));
vi.mock('../src/clients/cloudinary.client.js', () => ({
  getUploadedAsset: async (publicId) => ({ bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: publicId.split('/').pop(), width: 900, height: 600 }),
  destroyImage: async () => {},
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AUDIT_DENY } = await import('../src/services/audit.service.js');
const { AuditLog, FarmerProfile, User } = await import('../src/models/index.js');

let r;
const list = async (query = '') => (await r.kaluppa.get(`/api/audit-logs${query}`).expect(200)).body;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
});
afterAll(stopMemoryDb);

/**
 * Coverage (PHASE-2-SPEC §3.12, §3.15): each Phase 2 mutation, run once, writes exactly one audit entry,
 * and no entry holds a denied field, a password or an uploaded document.
 */
describe('every Phase 2 mutation writes one audit entry', () => {
  const ids = {};
  const once = (name, call) =>
    it(name, async () => {
      const before = await AuditLog.countDocuments();
      const res = await call();
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(300);
      const entries = await AuditLog.find().sort({ at: -1, _id: -1 }).limit((await AuditLog.countDocuments()) - before).lean();
      expect(entries).toHaveLength(1);
      const [entry] = entries;
      for (const c of entry.changes) expect(AUDIT_DENY.has(c.field), c.field).toBe(false);
      expect(JSON.stringify(entry)).not.toMatch(/KapeKonek@123|cloudinary|\$2[aby]\$/);
      return res;
    });

  once('association create', async () => {
    const res = await r.kaluppa.post('/api/associations').send({ name: 'Mogpog Growers', municipality: 'Mogpog' });
    ids.association = res.body.data?.id;
    return res;
  });
  once('association edit', () => r.kaluppa.patch(`/api/associations/${ids.association}`).send({ name: 'Mogpog Coffee Growers', municipality: 'Mogpog', description: 'Highland farms' }));
  once('association archive', () => r.kaluppa.post(`/api/associations/${ids.association}/archive`));
  once('association restore', () => r.kaluppa.post(`/api/associations/${ids.association}/restore`));
  once('Group Manager create (assign later)', async () => {
    const res = await r.kaluppa.post('/api/group-managers').send({ firstName: 'Lena', lastName: 'Ramos', username: 'lena.ramos', email: 'lena.ramos@example.com', contactNumber: '09175550111' });
    ids.gm = res.body.data?.id;
    return res;
  });
  once('Group Manager edit', () =>
    r.kaluppa.patch(`/api/group-managers/${ids.gm}`).send({ firstName: 'Lena', lastName: 'Ramos-Cruz', username: 'lena.ramos', email: 'lena.ramos@example.com', contactNumber: '09175550111' }));
  it('sign-up records agreeing to the terms (Change 09)', async () => {
    ids.joy = await registerFarmer(app, User, 'joy');
    expect(await AuditLog.findOne({ entityId: ids.joy.user._id, action: 'accept_terms' }).lean()).toMatchObject({ area: 'accounts', changes: [{ field: 'termsVersion', to: 1 }] });
  });
  once('farmer request to join (documents never logged)', async () => {
    const f = ids.joy;
    return f.agent.post('/api/me/farmer-profile/request').send({ associationId: r.a.santacruz.id, ...documentsOf(f.user._id) });
  });
  once('farmer approve', () => r.manager.post(`/api/farmers/${ids.joy.user._id}/approve`));
  once('farm create', async () => {
    const res = await r.ana.agent.post('/api/farms').send(farmBody());
    ids.farm = res.body.data?.id;
    return res;
  });
  once('farm edit', () => r.ana.agent.patch(`/api/farms/${ids.farm}`).send(farmBody({ sizeHa: 2.5 })));
  once('tree group add', async () => {
    const res = await r.ana.agent.post('/api/tree-groups').send({ farmId: ids.farm, variety: 'liberica', stage: 'growing', count: 50, plantedAt: dayKey(-300) });
    ids.tree = res.body.data?.id;
    return res;
  });
  once('tree group stage change', () => r.ana.agent.patch(`/api/tree-groups/${ids.tree}`).send({ farmId: ids.farm, variety: 'liberica', stage: 'flowering', count: 50, plantedAt: dayKey(-300) }));
  once('harvest record', async () => {
    const res = await r.ana.agent.post('/api/harvests').send({ farmId: ids.farm, variety: 'liberica', yieldKg: 20, harvestedAt: dayKey(-1) });
    ids.harvest = res.body.data?.id;
    return res;
  });
  once('harvest edit', () => r.ana.agent.patch(`/api/harvests/${ids.harvest}`).send({ farmId: ids.farm, variety: 'liberica', yieldKg: 22.5, harvestedAt: dayKey(-1) }));
  once('harvest archive', () => r.ana.agent.post(`/api/harvests/${ids.harvest}/archive`));
  once('tree group archive', () => r.ana.agent.post(`/api/tree-groups/${ids.tree}/archive`));
  once('farm archive', () => r.ana.agent.post(`/api/farms/${ids.farm}/archive`));
  once('farm restore', () => r.ana.agent.post(`/api/farms/${ids.farm}/restore`));
  once('bean listing', async () => {
    const res = await r.ana.agent.post('/api/beans').send(beanBody(r.ana.user._id));
    ids.bean = res.body.data?.id;
    return res;
  });
  once('bean approve', () => r.kaluppa.post(`/api/beans/${ids.bean}/approve`));
  once('bean complete', () => r.kaluppa.post(`/api/beans/${ids.bean}/complete`).send({ finalWeightKg: 2, finalAmountCentavos: 36_000 }));
  once('bean reject', async () => {
    const listed = await r.ana.agent.post('/api/beans').send(beanBody(r.ana.user._id, { weightKg: 1 }));
    await AuditLog.deleteOne({ entityId: listed.body.data.id, action: 'create' }); // only the rejection is under test
    return r.kaluppa.post(`/api/beans/${listed.body.data.id}/reject`).send({ reason: 'Beans are still wet' });
  });
  once('delivery settings', () =>
    r.kaluppa.patch('/api/admin/settings/delivery').send({ baseFeeCentavos: 6000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60, minBusinessDays: 2, maxBusinessDays: 4 }));
  once('Hub post create', async () => {
    const res = await r.ana.agent.post('/api/hub/posts').send({ body: 'Pruning day at the farm', tags: ['pruning'] });
    ids.post = res.body.data?._id;
    return res;
  });
  once('Hub post remove (Kaluppa)', () => r.kaluppa.post(`/api/hub/posts/${ids.post}/remove`).send({ reason: 'Duplicate of another post' }));
});

describe('GET /audit-logs (Kaluppa only)', () => {
  it('lists newest first, page-numbered, with the actor, area, action, record and changes', async () => {
    const body = await list('?limit=5');
    expect(body.meta).toMatchObject({ page: 1, limit: 5, total: expect.any(Number) });
    expect(body.data).toHaveLength(5);
    const times = body.data.map((e) => new Date(e.at).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(body.data[0]).toMatchObject({ id: expect.any(String), code: expect.stringMatching(/^AUD-[0-9A-F]{8}$/), area: 'hub', action: 'remove', actorRole: 'kaluppa', actor: { name: expect.any(String) } });
  });

  it('filters by area, role, search, record and dates', async () => {
    expect((await list('?area=farms')).data.every((e) => e.area === 'farms')).toBe(true);
    const farmers = (await list('?role=farmer')).data;
    expect(farmers.length).toBeGreaterThan(0);
    expect(farmers.every((e) => e.actorRole === 'farmer')).toBe(true);
    expect((await list('?q=Mogpog')).data.every((e) => e.entityType === 'association')).toBe(true);
    expect((await list('?q=Ana%20Farmer')).data.every((e) => e.actorRole === 'farmer')).toBe(true);
    const farmId = (await list('?area=farms')).data[0].entityId;
    expect((await list(`?entity=${farmId}`)).data.every((e) => e.entityId === farmId)).toBe(true);
    expect((await list(`?from=${dayKey(1)}`)).data).toEqual([]);
    expect((await list(`?from=${dayKey(0)}&to=${dayKey(0)}`)).meta.total).toBe((await list()).meta.total);
  });

  it('the system is an actor too', async () => {
    await AuditLog.create({ actor: null, actorRole: 'system', area: 'beans', action: 'expire', entityType: 'bean_listing', entityId: r.farms.ana.id, entityLabel: 'BN-1' });
    const [entry] = (await list('?role=system')).data;
    expect(entry).toMatchObject({ actor: null, actorRole: 'system', action: 'expire' });
  });

  it('GET /audit-logs/:id returns one entry; an unknown id is 404', async () => {
    const [first] = (await list()).data;
    expect((await r.kaluppa.get(`/api/audit-logs/${first.id}`).expect(200)).body.data).toEqual(first);
    await r.kaluppa.get('/api/audit-logs/64b7f0f0f0f0f0f0f0f0f0f0').expect(404);
  });

  it('exports the filtered entries as CSV', async () => {
    const res = await r.kaluppa.get('/api/audit-logs/export?format=csv&area=farms').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/kapekonek-audit-log-\d{4}-\d{2}-\d{2}\.csv/);
    const lines = res.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toBe('Entry,When,Who,Role,Area,Action,Record,Changes');
    expect(lines.length - 1).toBe((await list('?area=farms')).meta.total);
    expect(lines.slice(1).every((l) => l.includes(',Farms,'))).toBe(true);
    const pdf = await r.kaluppa.get('/api/audit-logs/export?format=pdf&area=farms').expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(await AuditLog.countDocuments({ area: 'audit_log', action: 'export' })).toBe(2);
  });

  it('is for Kaluppa only and validates its filters', async () => {
    expect((await r.manager.get('/api/audit-logs')).status).toBe(403);
    expect((await r.ana.agent.get('/api/audit-logs/export?format=csv')).status).toBe(403);
    expect((await r.kaluppa.get('/api/audit-logs?area=nope')).status).toBe(400);
    expect((await r.kaluppa.get('/api/audit-logs?from=yesterday')).status).toBe(400);
  });
});
