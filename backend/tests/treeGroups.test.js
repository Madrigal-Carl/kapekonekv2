import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { dayKey, setUpRecords } from './helpers/records.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, FarmerProfile, User } = await import('../src/models/index.js');

let r;
const ids = {};
const group = (farmId, fields = {}) => ({ farmId, variety: 'liberica', stage: 'fruiting', count: 40, plantedAt: '2022-03-15', note: '', ...fields });
const listOf = async (agent, query = '') => (await agent.get(`/api/tree-groups${query}`).expect(200)).body;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
});
afterAll(stopMemoryDb);

describe('adding tree groups', () => {
  it('the owner adds one; recordedBy comes from the actor', async () => {
    const res = await r.ana.agent.post('/api/tree-groups').send(group(r.farms.ana.id, { note: 'Shade-grown under coconut' })).expect(201);
    expect(res.body.data).toMatchObject({
      farm: { id: r.farms.ana.id, propertyNumber: r.farms.ana.propertyNumber },
      owner: { name: 'Ana Farmer' }, variety: 'liberica', stage: 'fruiting', count: 40, plantedAt: '2022-03-15',
      recordedBy: { name: 'Ana Farmer' }, status: 'active', canEdit: true,
    });
    ids.ana = res.body.data.id;
  });

  it('stages are exactly the five keys; count 1–100,000; planted date not in the future', async () => {
    const post = (fields) => r.ana.agent.post('/api/tree-groups').send(group(r.farms.ana.id, fields));
    expect((await post({ stage: 'dead' })).body.errors).toHaveProperty('stage');
    expect((await post({ count: 0 })).body.errors).toHaveProperty('count');
    expect((await post({ count: 100_001 })).body.errors).toHaveProperty('count');
    expect((await post({ count: 2.5 })).body.errors).toHaveProperty('count');
    expect((await post({ plantedAt: dayKey(2) })).body.errors).toHaveProperty('plantedAt');
    expect((await post({ variety: 'kopi luwak' })).body.errors).toHaveProperty('variety');
    for (const stage of ['newly_planted', 'growing', 'flowering', 'fruiting', 'damaged']) {
      await post({ stage, variety: 'excelsa', count: 10, plantedAt: dayKey(0) }).expect(201);
    }
  });

  it('scope follows the farm: the Group Manager on its farmers’ farms and its managed Kaluppa farm; Kaluppa only on Kaluppa farms', async () => {
    const recorded = await r.manager.post('/api/tree-groups').send(group(r.farms.ana.id, { variety: 'robusta' })).expect(201);
    expect(recorded.body.data.recordedBy.name).toBe('Liza Ramos');
    ids.kal = (await r.manager.post('/api/tree-groups').send(group(r.farms.kalManaged.id, { variety: 'arabica', count: 300 })).expect(201)).body.data.id;
    expect((await r.manager.post('/api/tree-groups').send(group(r.farms.ben.id))).status).toBe(404);
    expect((await r.manager.post('/api/tree-groups').send(group(r.farms.kalOpen.id))).status).toBe(404);
    expect((await r.kaluppa.post('/api/tree-groups').send(group(r.farms.ana.id))).status).toBe(403);
    await r.kaluppa.post('/api/tree-groups').send(group(r.farms.kalOpen.id, { stage: 'newly_planted' })).expect(201);
    expect((await r.ben.agent.post('/api/tree-groups').send(group(r.farms.ana.id))).status).toBe(404);
    expect((await r.ben.agent.patch(`/api/tree-groups/${ids.ana}`).send(group(r.farms.ana.id))).status).toBe(404);
  });
});

describe('listing', () => {
  it('each role sees the groups on farms it can see, with stage totals', async () => {
    const mine = await listOf(r.ana.agent);
    expect(mine.data).toHaveLength(7);
    expect(mine.meta.stageTotals).toEqual({ newly_planted: 10, growing: 10, flowering: 10, fruiting: 90, damaged: 10 });
    expect((await listOf(r.manager)).data).toHaveLength(8);
    expect((await listOf(r.boacManager)).data).toHaveLength(0);
    expect((await listOf(r.kaluppa)).data).toHaveLength(9);
  });

  it('filters by farm, variety and stage', async () => {
    expect((await listOf(r.manager, `?farmId=${r.farms.kalManaged.id}`)).data.map((g) => g.variety)).toEqual(['arabica']);
    expect((await listOf(r.ana.agent, '?variety=excelsa')).data).toHaveLength(5);
    expect((await listOf(r.ana.agent, '?stage=damaged')).data).toHaveLength(1);
    expect((await listOf(r.ana.agent, '?q=coconut')).data.map((g) => g.id)).toEqual([ids.ana]);
  });

  it('the farm shows its trees and varieties', async () => {
    const farm = (await r.ana.agent.get(`/api/farms/${r.farms.ana.id}`)).body.data;
    expect(farm).toMatchObject({ treeCount: 130, groupCount: 7, varieties: ['excelsa', 'liberica', 'robusta'], canManageRecords: true });
    expect((await r.manager.get(`/api/farms/${r.farms.kalManaged.id}`)).body.data).toMatchObject({ canEdit: false, canManageRecords: true });
  });
});

describe('edit, archive and restore', () => {
  it('editing changes the fields and is audited', async () => {
    const res = await r.ana.agent.patch(`/api/tree-groups/${ids.ana}`).send(group(r.farms.ana.id, { stage: 'damaged', note: 'Leaf rust after the October rains' })).expect(200);
    expect(res.body.data.stage).toBe('damaged');
    const entry = await AuditLog.findOne({ area: 'trees', action: 'update', entityId: ids.ana }).lean();
    expect(entry.changes).toEqual(expect.arrayContaining([{ field: 'stage', from: 'fruiting', to: 'damaged' }]));
  });

  it('archive and restore one group', async () => {
    await r.ana.agent.post(`/api/tree-groups/${ids.ana}/archive`).expect(200);
    expect((await listOf(r.ana.agent, '?status=archived')).data.map((g) => g.id)).toEqual([ids.ana]);
    expect((await r.ana.agent.patch(`/api/tree-groups/${ids.ana}`).send(group(r.farms.ana.id))).status).toBe(409);
    await r.ana.agent.post(`/api/tree-groups/${ids.ana}/restore`).expect(200);
    expect(await AuditLog.distinct('action', { area: 'trees' })).toEqual(expect.arrayContaining(['create', 'update', 'archive', 'restore']));
  });

  it('archiving a farm archives its groups; restoring it brings back only those', async () => {
    const own = (await r.ana.agent.post('/api/tree-groups').send(group(r.farms.ana2.id)).expect(201)).body.data.id;
    const archivedBefore = (await r.ana.agent.post('/api/tree-groups').send(group(r.farms.ana2.id, { variety: 'excelsa' })).expect(201)).body.data.id;
    await r.ana.agent.post(`/api/tree-groups/${archivedBefore}/archive`).expect(200);
    await r.ana.agent.post(`/api/farms/${r.farms.ana2.id}/archive`).expect(200);
    const archived = (await listOf(r.ana.agent, '?status=archived')).data.map((g) => g.id);
    expect(archived).toEqual(expect.arrayContaining([own, archivedBefore]));
    expect((await r.ana.agent.post('/api/tree-groups').send(group(r.farms.ana2.id))).status).toBe(409); // archived farm
    expect((await r.ana.agent.post(`/api/tree-groups/${own}/restore`)).status).toBe(409); // restore the farm first
    await r.ana.agent.post(`/api/farms/${r.farms.ana2.id}/restore`).expect(200);
    const active = (await listOf(r.ana.agent, `?farmId=${r.farms.ana2.id}`)).data.map((g) => g.id);
    expect(active).toEqual([own]);
  });
});
