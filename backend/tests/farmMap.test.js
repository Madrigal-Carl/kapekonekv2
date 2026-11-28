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
const { FarmerProfile, User } = await import('../src/models/index.js');

let r;
// Farms are named by their key in `r.farms`.
const nameOf = (f) => Object.keys(r.farms).find((k) => r.farms[k].id === f.id);
const lots = (body) => body.data.farms.map(nameOf).sort();
const map = async (agent, query = '') => (await agent.get(`/api/map/farms${query}`).expect(200)).body;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
  const group = (agent, farmId, variety, stage, count) =>
    agent.post('/api/tree-groups').send({ farmId, variety, stage, count, plantedAt: dayKey(-400) }).expect(201);
  await group(r.ana.agent, r.farms.ana.id, 'liberica', 'fruiting', 60);
  await group(r.ana.agent, r.farms.ana.id, 'excelsa', 'growing', 40);
  await group(r.ben.agent, r.farms.ben.id, 'robusta', 'flowering', 30);
  await r.ana.agent.post('/api/harvests').send({ farmId: r.farms.ana.id, variety: 'liberica', yieldKg: 110, harvestedAt: dayKey(-3) }).expect(201);
});
afterAll(stopMemoryDb);

describe('GET /map/farms', () => {
  it('a farmer sees only their own farms', async () => {
    expect(lots(await map(r.ana.agent))).toEqual(['ana', 'ana2']);
  });

  it('a Group Manager sees its association’s farms and the Kaluppa farm it manages', async () => {
    expect(lots(await map(r.manager))).toEqual(['ana', 'ana2', 'kalManaged']);
  });

  it('Kaluppa sees every farm, with Kaluppa farms marked', async () => {
    const body = await map(r.kaluppa);
    expect(lots(body)).toEqual(['ana', 'ana2', 'ben', 'kalManaged', 'kalOpen']);
    expect(body.data.farms.filter((f) => f.ownerType === 'kaluppa').map(nameOf).sort()).toEqual(['kalManaged', 'kalOpen']);
  });

  it('carries the popover fields: trees by variety, main stages, last harvest, Managed by', async () => {
    const { farms } = (await map(r.kaluppa)).data;
    const ana = farms.find((f) => nameOf(f) === 'ana');
    expect(ana).toMatchObject({
      propertyNumber: r.farms.ana.propertyNumber,
      owner: { name: 'Ana Farmer' },
      association: { id: r.a.santacruz.id, name: 'Santa Cruz Growers' },
      sizeHa: 1.2,
      municipality: 'Santa Cruz',
      barangay: 'Pantayin',
      location: { lat: expect.any(Number), lng: expect.any(Number) },
      treeCount: 100,
      varieties: [{ variety: 'liberica', count: 60 }, { variety: 'excelsa', count: 40 }],
      stages: [{ stage: 'fruiting', pct: 60 }, { stage: 'growing', pct: 40 }],
      lastHarvest: { yieldKg: 110, harvestedAt: dayKey(-3) },
      managedBy: null,
    });
    expect(farms.find((f) => nameOf(f) === 'kalManaged').managedBy).toMatchObject({ name: expect.stringMatching(/\w/) });
    expect(farms.find((f) => nameOf(f) === 'ana2')).toMatchObject({ treeCount: 0, varieties: [], stages: [], lastHarvest: null });
  });

  it('filters by variety (farms with active trees of it) and municipality', async () => {
    expect(lots(await map(r.kaluppa, '?variety=robusta'))).toEqual(['ben']);
    expect(lots(await map(r.kaluppa, '?municipality=Torrijos'))).toEqual(['kalOpen']);
    expect(lots(await map(r.ana.agent, '?variety=robusta'))).toEqual([]);
  });

  it('filters by association for Kaluppa; a Group Manager stays in its own scope', async () => {
    expect(lots(await map(r.kaluppa, `?association=${r.a.boac.id}`))).toEqual(['ben']);
    expect(lots(await map(r.manager, `?association=${r.a.boac.id}`))).toEqual(['ana', 'ana2', 'kalManaged']);
  });

  it('includes the Kaluppa branch pin; archived farms are left out', async () => {
    const body = await map(r.kaluppa);
    expect(body.data.branch).toMatchObject({ name: expect.any(String), location: { lat: expect.any(Number), lng: expect.any(Number) } });
    await r.ana.agent.post(`/api/farms/${r.farms.ana2.id}/archive`).expect(200);
    expect(lots(await map(r.ana.agent))).toEqual(['ana']);
  });

  it('needs a signed-in user with map.view', async () => {
    await (await import('supertest')).default(app).get('/api/map/farms').expect(401);
    expect((await r.kaluppa.get('/api/map/farms?variety=coffee')).status).toBe(400);
  });
});
