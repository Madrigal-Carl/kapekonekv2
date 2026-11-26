import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { makeOrder } from './helpers/orders.js';
import { dayKey, setUpRecords } from './helpers/records.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { BeanListing, FarmerProfile, User } = await import('../src/models/index.js');

let r;
let listing = 0;
const get = async (agent, path) => (await agent.get(`/api/reports/${path}`).expect(200)).body.data;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const DAY = 86_400_000;

/** A completed sale straight in Mongo (the review flow has its own tests). */
const completed = (farmer, association, kg, centavos, daysAgo) =>
  BeanListing.create({
    listingNumber: `BN-TEST-${++listing}`, farmer: farmer._id, association, recordedBy: farmer._id, variety: 'liberica', form: 'dried_cherry',
    weightKg: kg, pricePerKgCentavos: 18_000, status: 'completed', countsTowardCap: false,
    completion: { finalWeightKg: kg, finalAmountCentavos: centavos, at: new Date(Date.now() - daysAgo * DAY) },
  });

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  r = await setUpRecords(app, { User, FarmerProfile });
  const group = (agent, farmId, variety, stage, count) =>
    agent.post('/api/tree-groups').send({ farmId, variety, stage, count, plantedAt: dayKey(-800) }).expect(201);
  const harvest = (agent, farmId, variety, yieldKg, days) => agent.post('/api/harvests').send({ farmId, variety, yieldKg, harvestedAt: dayKey(days) }).expect(201);
  await group(r.ana.agent, r.farms.ana.id, 'liberica', 'fruiting', 60);
  await group(r.ben.agent, r.farms.ben.id, 'robusta', 'flowering', 30);
  await group(r.kaluppa, r.farms.kalManaged.id, 'excelsa', 'growing', 100);
  await harvest(r.ana.agent, r.farms.ana.id, 'liberica', 100, -3);
  await harvest(r.ana.agent, r.farms.ana.id, 'liberica', 50, -400); // the previous 12 months
  await harvest(r.ben.agent, r.farms.ben.id, 'robusta', 40, -10);
  await harvest(r.kaluppa, r.farms.kalManaged.id, 'excelsa', 200, -5);
  await completed(r.ana.user, r.a.santacruz.id, 12, 216_000, 2);
  await completed(r.ben.user, r.a.boac.id, 5, 90_000, 4);
  const product = { x: { _id: new mongoose.Types.ObjectId(), name: 'Barako', unit: 'pack', priceCentavos: 50_000 } };
  await makeOrder(product, { status: 'sold', method: 'pickup', items: [['x', 2]] });
  await makeOrder(product, { status: 'pending', method: 'pickup', items: [['x', 1]] });
});
afterAll(stopMemoryDb);

describe('reports for Kaluppa', () => {
  it('summary totals every association and Kaluppa farms in the period', async () => {
    const s = await get(r.kaluppa, 'summary');
    expect(s.harvest).toEqual({ kg: 340, previous: 50, pct: 580 });
    expect(s.beans).toEqual({ kg: 17, paidCentavos: 306_000 });
    expect(s.sales).toEqual({ centavos: 100_000, count: 1 });
    expect(s.farmers).toMatchObject({ count: 2, newInPeriod: 2 });
  });

  it('harvest by variety per month (12 Manila months), beans and sales per month', async () => {
    const h = await get(r.kaluppa, 'harvest');
    expect(h.labels).toHaveLength(12);
    const kg = Object.fromEntries(h.series.map((s) => [s.variety, sum(s.values)]));
    expect(kg).toEqual({ liberica: 100, excelsa: 200, robusta: 40, arabica: 0 });
    expect(sum((await get(r.kaluppa, 'beans')).values)).toBe(17);
    expect(sum((await get(r.kaluppa, 'sales')).values)).toBe(100_000);
  });

  it('trees by stage, as of now', async () => {
    const t = await get(r.kaluppa, 'trees');
    expect(t.total).toBe(190);
    expect(Object.fromEntries(t.byStage.map((s) => [s.stage, s.count]))).toMatchObject({ fruiting: 60, flowering: 30, growing: 100, newly_planted: 0 });
  });

  it('breaks down by association with a Kaluppa farms row', async () => {
    const b = await get(r.kaluppa, 'breakdown');
    expect(b.kind).toBe('association');
    const row = (name) => b.rows.find((x) => x.name === name);
    expect(row('Santa Cruz Growers')).toMatchObject({ farmers: 1, farms: 2, trees: 60, harvestKg: 100, beansKg: 12, paidCentavos: 216_000 });
    expect(row('Boac Growers')).toMatchObject({ farmers: 1, farms: 1, trees: 30, harvestKg: 40, beansKg: 5, paidCentavos: 90_000 });
    expect(row('Gasan Growers')).toMatchObject({ farmers: 0, farms: 0, harvestKg: 0 });
    expect(row('Kaluppa farms')).toMatchObject({ farmers: null, farms: 2, trees: 100, harvestKg: 200, beansKg: null });
  });

  it('the association filter narrows every section', async () => {
    const q = `?association=${r.a.boac.id}`;
    expect((await get(r.kaluppa, `summary${q}`)).harvest.kg).toBe(40);
    expect((await get(r.kaluppa, `trees${q}`)).total).toBe(30);
    expect((await get(r.kaluppa, `breakdown${q}`)).rows.map((x) => x.name)).toEqual(['Boac Growers']);
  });

  it('the period filter: last year has only the old harvest', async () => {
    const lastYear = await get(r.kaluppa, 'summary?period=last_year');
    // dayKey(-400) is in last calendar year unless today is early in the year; either way this year's harvests aren't.
    expect(lastYear.harvest.kg).toBeLessThanOrEqual(50);
    expect(lastYear.beans.kg).toBe(0);
  });
});

describe('reports for a Group Manager', () => {
  it('are its association only (with the Kaluppa farm it manages), by farmer', async () => {
    const s = await get(r.manager, 'summary');
    expect(s.harvest.kg).toBe(300);
    expect(s.beans).toEqual({ kg: 12, paidCentavos: 216_000 });
    expect(s.farms).toEqual({ count: 3, ha: 3.6 });
    expect(s.sales).toBeUndefined();
    const b = await get(r.manager, 'breakdown');
    expect(b.kind).toBe('farmer');
    expect(b.rows).toEqual([
      { name: 'Ana Farmer', farmers: null, farms: 2, trees: 60, harvestKg: 100, beansKg: 12, paidCentavos: 216_000 },
      { name: 'Kaluppa farms', farmers: null, farms: 1, trees: 100, harvestKg: 200, beansKg: null, paidCentavos: null },
    ]);
  });

  it('can’t read another association: the filter is forced to its own', async () => {
    const s = await get(r.manager, `summary?association=${r.a.boac.id}`);
    expect(s.harvest.kg).toBe(300);
    expect((await get(r.manager, `breakdown?association=${r.a.boac.id}`)).rows.map((x) => x.name)).not.toContain('Ben Farmer');
  });

  it('has no store sales section; farmers have no reports', async () => {
    expect((await r.manager.get('/api/reports/sales')).status).toBe(403);
    expect((await r.manager.get('/api/reports/export.csv?section=sales')).status).toBe(403);
    expect((await r.ana.agent.get('/api/reports/summary')).status).toBe(403);
  });
});

describe('CSV export', () => {
  it('exports one section as CSV', async () => {
    const res = await r.kaluppa.get('/api/reports/export.csv?section=breakdown').expect(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/report-breakdown/);
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('Association,Farmers,Farms,Trees,Harvest (kg),Beans sold (kg),Paid (PHP)');
    expect(lines).toContain('Santa Cruz Growers,1,2,60,100,12,2160.00');
  });

  it('Export all stacks every section the user may see', async () => {
    const all = (await r.kaluppa.get('/api/reports/export.csv?section=all').expect(200)).text;
    for (const title of ['Harvest by variety', 'Beans bought by Kaluppa', 'Store sales', 'Trees by stage', 'By association']) expect(all).toContain(title);
    const gm = (await r.manager.get('/api/reports/export.csv?section=all').expect(200)).text;
    expect(gm).not.toContain('Store sales');
    expect(gm).toContain('By farmer');
  });

  it('keeps a formula-looking name as text', async () => {
    await r.kaluppa.post('/api/associations').send({ name: '=HYPERLINK("x")', municipality: 'Mogpog' }).expect(201);
    const text = (await r.kaluppa.get('/api/reports/export.csv?section=breakdown').expect(200)).text;
    expect(text).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it('rejects an unknown section or period', async () => {
    expect((await r.kaluppa.get('/api/reports/export.csv?section=secrets')).status).toBe(400);
    expect((await r.kaluppa.get('/api/reports/summary?period=forever')).status).toBe(400);
    expect((await r.kaluppa.get('/api/reports/whatever')).status).toBe(400);
  });
});
