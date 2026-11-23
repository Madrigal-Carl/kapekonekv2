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
const { AuditLog, FarmerProfile, Harvest, User } = await import('../src/models/index.js');

let r;
const ids = {};
const harvest = (farmId, fields = {}) => ({ farmId, variety: 'liberica', yieldKg: 110, harvestedAt: dayKey(-5), note: '', ...fields });
const listOf = async (agent, query = '') => (await agent.get(`/api/harvests${query}`).expect(200)).body;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
  const trees = (agent, farmId, variety) =>
    agent.post('/api/tree-groups').send({ farmId, variety, stage: 'fruiting', count: 40, plantedAt: '2021-06-01' }).expect(201);
  await trees(r.ana.agent, r.farms.ana.id, 'liberica');
  await trees(r.ana.agent, r.farms.ana.id, 'excelsa');
  await trees(r.manager, r.farms.kalManaged.id, 'arabica');
  await trees(r.ben.agent, r.farms.ben.id, 'robusta');
});
afterAll(stopMemoryDb);

describe('recording harvests', () => {
  it('the owner records one; recordedBy comes from the actor', async () => {
    const res = await r.ana.agent.post('/api/harvests').send(harvest(r.farms.ana.id, { note: 'Red cherries only' })).expect(201);
    expect(res.body.data).toMatchObject({
      farm: { id: r.farms.ana.id, lotNumber: 'Ana 1' }, owner: { name: 'Ana Farmer' }, variety: 'liberica', yieldKg: 110,
      harvestedAt: dayKey(-5), recordedBy: { name: 'Ana Farmer' }, status: 'active', canEdit: true,
    });
    ids.ana = res.body.data.id;
  });

  it('only a variety the farm has active trees of', async () => {
    const res = await r.ana.agent.post('/api/harvests').send(harvest(r.farms.ana.id, { variety: 'robusta' }));
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ variety: 'This farm has no Robusta trees. Pick Excelsa or Liberica.' });
  });

  it('yield 0.5–100,000 kg in 0.5 steps; date not in the future', async () => {
    const post = (fields) => r.ana.agent.post('/api/harvests').send(harvest(r.farms.ana.id, fields));
    expect((await post({ yieldKg: 1.25 })).body.errors).toHaveProperty('yieldKg');
    expect((await post({ yieldKg: 0 })).body.errors).toHaveProperty('yieldKg');
    expect((await post({ yieldKg: 100_000.5 })).body.errors).toHaveProperty('yieldKg');
    expect((await post({ harvestedAt: dayKey(1) })).body.errors).toHaveProperty('harvestedAt');
    await post({ variety: 'excelsa', yieldKg: 60.5, harvestedAt: dayKey(-40) }).expect(201);
    await post({ yieldKg: 40, harvestedAt: '2024-11-02' }).expect(201);
  });

  it('scope follows the farm', async () => {
    const byManager = await r.manager.post('/api/harvests').send(harvest(r.farms.kalManaged.id, { variety: 'arabica', yieldKg: 640 })).expect(201);
    expect(byManager.body.data.recordedBy.name).toBe('Liza Ramos');
    expect((await r.manager.post('/api/harvests').send(harvest(r.farms.ben.id, { variety: 'robusta' }))).status).toBe(404);
    expect((await r.kaluppa.post('/api/harvests').send(harvest(r.farms.ana.id))).status).toBe(403);
    expect((await r.ben.agent.patch(`/api/harvests/${ids.ana}`).send(harvest(r.farms.ana.id))).status).toBe(404);
    await r.ben.agent.post('/api/harvests').send(harvest(r.farms.ben.id, { variety: 'robusta', yieldKg: 90 })).expect(201);
  });
});

describe('listing', () => {
  it('each role sees harvests on farms it can see, filtered by farm, variety and period', async () => {
    expect((await listOf(r.ana.agent)).data).toHaveLength(2); // the 2024 harvest is outside the default 12 months
    expect((await listOf(r.ana.agent, '?period=all')).data).toHaveLength(3);
    expect((await listOf(r.ana.agent, '?period=last_year&variety=liberica')).data).toHaveLength(0);
    expect((await listOf(r.manager, '?period=all')).data).toHaveLength(4);
    expect((await listOf(r.manager, `?farmId=${r.farms.kalManaged.id}`)).data.map((h) => h.yieldKg)).toEqual([640]);
    expect((await listOf(r.boacManager)).data).toHaveLength(1);
    expect((await listOf(r.kaluppa, '?period=all')).data).toHaveLength(5);
  });

  it('a summary for the tiles: this year, top variety, last harvest', async () => {
    const { meta } = await listOf(r.ana.agent);
    expect(meta.summary).toMatchObject({ lastHarvest: { yieldKg: 110, harvestedAt: dayKey(-5) } });
    expect(meta.summary.topVariety).toMatchObject({ variety: 'liberica' });
  });

  it('the farm shows its last harvest', async () => {
    const farm = (await r.ana.agent.get(`/api/farms/${r.farms.ana.id}`)).body.data;
    expect(farm.lastHarvest).toEqual({ yieldKg: 110, harvestedAt: dayKey(-5) });
  });
});

describe('edit, archive and restore', () => {
  it('edit, archive, restore — all audited', async () => {
    await r.ana.agent.patch(`/api/harvests/${ids.ana}`).send(harvest(r.farms.ana.id, { yieldKg: 112.5 })).expect(200);
    await r.ana.agent.post(`/api/harvests/${ids.ana}/archive`).expect(200);
    expect((await listOf(r.ana.agent, '?status=archived')).data.map((h) => h.id)).toEqual([ids.ana]);
    await r.ana.agent.post(`/api/harvests/${ids.ana}/restore`).expect(200);
    expect(await AuditLog.distinct('action', { area: 'harvests' })).toEqual(expect.arrayContaining(['create', 'update', 'archive', 'restore']));
  });

  it('archiving the farm keeps its harvests', async () => {
    await r.ana.agent.post(`/api/farms/${r.farms.ana.id}/archive`).expect(200);
    expect(await Harvest.countDocuments({ farm: r.farms.ana.id, archivedAt: null })).toBe(3);
    expect((await listOf(r.ana.agent, '?period=all')).data).toHaveLength(3);
  });
});
