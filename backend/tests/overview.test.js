import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { setUpRecords } from './helpers/records.js';

// Change 06 Part B: GET /dashboard/overview?period= — period figures, the comparison and scope per role.
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User, FarmerProfile, Harvest, TreeGroup } = await import('../src/models/index.js');
const { periodRange } = await import('../src/utils/period.js');

let r;
const overview = async (agent, period = 'month') => (await agent.get(`/api/dashboard/overview?period=${period}`).expect(200)).body.data;
const sum = (values) => values.reduce((a, b) => a + b, 0);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
  const now = new Date();
  const lastMonth = new Date(periodRange('month', now).prevFrom.getTime() + 3600_000);
  const harvest = (farm, owner, yieldKg, harvestedAt, variety = 'liberica') =>
    Harvest.create({ farm: farm.id, owner: owner.user._id, variety, yieldKg, harvestedAt, recordedBy: owner.user._id });
  await harvest(r.farms.ana, r.ana, 10, now);
  await harvest(r.farms.ana2, r.ana, 4, now, 'excelsa');
  await harvest(r.farms.ana, r.ana, 28, lastMonth);
  await harvest(r.farms.ben, r.ben, 50, now);
  await TreeGroup.create({ farm: r.farms.ana.id, owner: r.ana.user._id, variety: 'liberica', count: 100, stage: 'growing', plantedAt: lastMonth, recordedBy: r.ana.user._id });
});
afterAll(stopMemoryDb);

describe('GET /dashboard/overview?period=', () => {
  it('farmer: their own harvest this month against last month, farms by town and trees as of now', async () => {
    const data = await overview(r.ana.agent);
    expect(data.period).toMatchObject({ key: 'month', rangeText: expect.stringMatching(/ – /), prevLabel: expect.any(String) });
    expect(data.kpis.harvest).toEqual({ kg: 14, count: 2, previous: 28, pct: -50 });
    expect(data.harvest).toHaveLength(data.period.labels.length);
    expect(sum(data.harvest)).toBe(14);
    expect(data.kpis.farms).toEqual({ count: 2, kaluppa: 0, byMunicipality: [{ municipality: 'Santa Cruz', count: 2 }] });
    expect(data.kpis.trees).toEqual({ count: 100, groups: 1 });
    expect(data.treesByStage).toEqual([{ stage: 'growing', count: 100 }]);
  });

  it('stock figures ignore the period; period figures follow it', async () => {
    const year = await overview(r.ana.agent, 'year');
    expect(year.period.labels).toHaveLength(12);
    expect(year.kpis.trees.count).toBe(100);
    expect(year.kpis.harvest.kg).toBeGreaterThanOrEqual(14); // last month's 28 kg is in this year unless it's January
    const today = await overview(r.ana.agent, 'today');
    expect(today.period.labels).toEqual(['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM']);
    expect(today.kpis.harvest).toMatchObject({ kg: 14, count: 2 });
    expect(today.kpis.farms.count).toBe(2);
  });

  it('Group Manager: its association’s farms and the Kaluppa farm it manages, harvest by variety, nothing from Boac', async () => {
    const data = await overview(r.manager);
    expect(data.kpis.farms).toMatchObject({ count: 3, kaluppa: 1 });
    expect(data.kpis.harvest).toMatchObject({ kg: 14, previous: 28, pct: -50 });
    const byVariety = Object.fromEntries(data.harvest.map((s) => [s.variety, sum(s.values)]));
    expect(byVariety).toEqual({ liberica: 10, excelsa: 4, arabica: 0, robusta: 0 });
  });

  it('Kaluppa: store sales and beans bought in the period, as buckets', async () => {
    const data = await overview(r.kaluppa, 'week');
    expect(data.period.labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(data.sales).toHaveLength(7);
    expect(sum(data.sales)).toBe(data.kpis.sales.centavos);
    expect(data.kpis.sales).toMatchObject({ count: expect.any(Number), pct: null });
    expect(data.beansBought).toHaveLength(7);
  });

  it('refuses an unknown period', async () => {
    const res = await r.ana.agent.get('/api/dashboard/overview?period=decade').expect(400);
    expect(res.body.errors.period).toBeTruthy();
  });
});
