import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { seedCatalogFixture } from './helpers/catalog.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { signedIn } from './helpers/farmers.js';
import { makeOrder } from './helpers/orders.js';
import { farmBody, setUpRecords } from './helpers/records.js';

// Change 06 Part C: GET /audit-logs/entity/:entityType/:entityId — whoever may view the record reads its history.
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User, FarmerProfile } = await import('../src/models/index.js');

let r;
let products;
const history = (agent, type, id, query = '') => agent.get(`/api/audit-logs/entity/${type}/${id}${query}`);

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  ({ products } = await seedCatalogFixture());
  r = await setUpRecords(app, { User, FarmerProfile });
});
afterAll(stopMemoryDb);

describe('record history', () => {
  it('the owner, their Group Manager and Kaluppa read a farm’s history; another farmer gets 404', async () => {
    const own = (await history(r.ana.agent, 'farm', r.farms.ana.id).expect(200)).body;
    expect(own.data).toEqual([expect.objectContaining({ action: 'create', area: 'farms', actor: expect.objectContaining({ name: 'Ana Farmer', initials: 'AF', avatarUrl: null }) })]);
    expect(own.meta).toMatchObject({ hasMore: false, nextCursor: null, canOpenAuditLog: false });
    await history(r.manager, 'farm', r.farms.ana.id).expect(200);
    expect((await history(r.kaluppa, 'farm', r.farms.ana.id).expect(200)).body.meta.canOpenAuditLog).toBe(true);
    await history(r.ben.agent, 'farm', r.farms.ana.id).expect(404);
    await history(r.manager, 'farm', r.farms.ben.id).expect(404);
  });

  it('pages newest first, 5 at a time, with the changed fields', async () => {
    for (let size = 2; size <= 7; size += 1) {
      await r.ana.agent.patch(`/api/farms/${r.farms.ana2.id}`).send(farmBody({ lotNumber: 'Ana 2', barangay: 'Matalaba', sizeHa: size })).expect(200);
    }
    const first = (await history(r.ana.agent, 'farm', r.farms.ana2.id).expect(200)).body;
    expect(first.data).toHaveLength(5);
    expect(first.data[0].changes).toEqual([{ field: 'sizeHa', from: 6, to: 7 }]);
    expect(first.meta.hasMore).toBe(true);
    const rest = (await history(r.ana.agent, 'farm', r.farms.ana2.id, `?cursor=${first.meta.nextCursor}`).expect(200)).body;
    expect(rest.data.map((e) => e.action)).toEqual(['update', 'create']);
    expect(rest.meta.hasMore).toBe(false);
  });

  it('records order status changes, the receipt check and the rider; the buyer reads them, others get 404', async () => {
    const order = await makeOrder(products, { paymentMethod: 'e_wallet' });
    await r.kaluppa.patch(`/api/orders/${order._id}/status`).send({ status: 'reserved' }).expect(200);
    await r.kaluppa.patch(`/api/orders/${order._id}/status`).send({ status: 'processing' }).expect(200);
    await r.kaluppa.patch(`/api/orders/${order._id}/status`).send({ status: 'out_for_delivery', rider: { name: 'Jun Rider', phone: '09171234567' } }).expect(200);
    const buyer = await signedIn(app, 'buyer');
    const { data } = (await history(buyer, 'order', order._id).expect(200)).body;
    expect(data.map((e) => e.action)).toEqual(['out_for_delivery', 'processing', 'reserved', 'receipt_check']);
    expect(data[0].changes).toEqual([
      { field: 'status', from: 'processing', to: 'out_for_delivery' },
      { field: 'rider', from: null, to: 'Jun Rider · 09171234567' },
    ]);
    expect(data[0].actor.name).toBe('Kaluppa Admin');
    await history(r.ana.agent, 'order', order._id).expect(404);
  });

  it('refuses an unknown record type and a buyer asking for a farm', async () => {
    await history(r.ana.agent, 'password', r.farms.ana.id).expect(400);
    await history(await signedIn(app, 'buyer'), 'farm', r.farms.ana.id).expect(404);
  });
});
