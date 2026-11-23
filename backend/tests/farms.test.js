import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn() }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, FarmerProfile, User } = await import('../src/models/index.js');

const YEAR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date());
const SANTA_CRUZ = { lat: 13.4778, lng: 122.03 };
const BOAC = { lat: 13.4467, lng: 121.8406 };
const farm = (fields = {}) => ({ lotNumber: 'Lot 1', sizeHa: 1.2, municipality: 'Santa Cruz', barangay: 'Pantayin', street: 'Sitio Ilaya', location: SANTA_CRUZ, ...fields });

let a; // associations
let kaluppa, manager, boacManager;
let ana, ben, nina; // { agent, user }
const ids = {};

/** A signed-up farmer, approved into an association (or left with none). */
async function farmerIn(username, association) {
  const f = await registerFarmer(app, User, username);
  if (association) await FarmerProfile.updateOne({ user: f.user._id }, { status: 'approved', association: association.id, approvedAt: new Date() });
  return f;
}
const listOf = async (agent, query = '') => (await agent.get(`/api/farms${query}`).expect(200)).body.data;
const lots = (items) => items.map((x) => x.lotNumber).sort();

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  a = await setUpAssociations(app, User);
  kaluppa = a.kaluppa;
  manager = await signedIn(app, 'manager.santacruz');
  boacManager = await signedIn(app, 'manager.unassigned'); // runs Boac in setUpAssociations
  ana = await farmerIn('ana', a.santacruz);
  ben = await farmerIn('ben', a.boac);
  nina = await farmerIn('nina', null);
});
afterAll(stopMemoryDb);

describe('creating farms', () => {
  it('a farmer adds their own farm; property numbers run in sequence for the year', async () => {
    const first = await ana.agent.post('/api/farms').send(farm()).expect(201);
    expect(first.body.data).toMatchObject({
      propertyNumber: `TCT-${YEAR}-0001`, lotNumber: 'Lot 1', ownerType: 'farmer', sizeHa: 1.2,
      owner: { id: String(ana.user._id), name: 'Ana Farmer' }, association: { id: a.santacruz.id }, location: SANTA_CRUZ,
      status: 'active', canEdit: true,
    });
    const second = await ana.agent.post('/api/farms').send(farm({ lotNumber: 'Lot 7', barangay: 'Matalaba' })).expect(201);
    expect(second.body.data.propertyNumber).toBe(`TCT-${YEAR}-0002`);
    ids.anaLot1 = first.body.data.id;
    ids.anaLot7 = second.body.data.id;
  });

  it('a farmer without an association can still record farms', async () => {
    const res = await nina.agent.post('/api/farms').send(farm({ lotNumber: 'Nina 1' })).expect(201);
    expect(res.body.data.association).toBeNull();
    ids.nina = res.body.data.id;
  });

  it('needs a pin inside Marinduque, a barangay of the municipality and the §7 limits', async () => {
    const noPin = farm({ lotNumber: 'No pin' });
    delete noPin.location;
    expect((await ana.agent.post('/api/farms').send(noPin)).body.errors).toHaveProperty('location');
    expect((await ana.agent.post('/api/farms').send(farm({ lotNumber: 'Far', location: { lat: 14.6, lng: 121 } }))).body.errors).toHaveProperty('location');
    const bad = await ana.agent.post('/api/farms').send(farm({ lotNumber: '', sizeHa: 0, barangay: 'Tumagabok' }));
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.errors)).toEqual(expect.arrayContaining(['lotNumber', 'sizeHa', 'barangay']));
  });

  it('a lot number is unique per owner, other owners may reuse it', async () => {
    const dup = await ana.agent.post('/api/farms').send(farm());
    expect(dup.status).toBe(409);
    expect(dup.body.errors).toEqual({ lotNumber: 'You already have a farm with this lot number' });
    ids.ben = (await ben.agent.post('/api/farms').send(farm({ municipality: 'Boac', barangay: 'Tumagabok', location: BOAC })).expect(201)).body.data.id;
  });

  it('a Group Manager must name one of its own approved farmers (Review Focus 1)', async () => {
    const missing = await manager.post('/api/farms').send(farm({ lotNumber: 'GM 1' }));
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toHaveProperty('farmerId');
    const other = await manager.post('/api/farms').send(farm({ lotNumber: 'GM 1', farmerId: String(ben.user._id) }));
    expect(other.status).toBe(404);
    expect(await AuditLog.countDocuments({ area: 'farms', entityLabel: /GM 1/ })).toBe(0);
    const unapproved = await manager.post('/api/farms').send(farm({ lotNumber: 'GM 1', farmerId: String(nina.user._id) }));
    expect(unapproved.status).toBe(404);
    const ok = await manager.post('/api/farms').send(farm({ lotNumber: 'GM 1', farmerId: String(ana.user._id) })).expect(201);
    expect(ok.body.data.owner.id).toBe(String(ana.user._id));
    ids.anaGm = ok.body.data.id;
  });

  it('Kaluppa adds Kaluppa farms, optionally managed by a Group Manager', async () => {
    const managerId = String((await User.findOne({ username: 'manager.santacruz' }))._id);
    const managed = await kaluppa.post('/api/farms').send(farm({ lotNumber: 'Kaluppa Demo Farm', managedById: managerId })).expect(201);
    expect(managed.body.data).toMatchObject({ ownerType: 'kaluppa', managedBy: { id: managerId, name: 'Liza Ramos' }, association: { id: a.santacruz.id }, assignedFarmers: [] });
    const unassigned = await kaluppa.post('/api/farms').send(farm({ lotNumber: 'Torrijos Nursery', municipality: 'Torrijos', barangay: 'Bonliw', location: { lat: 13.3189, lng: 122.0819 } })).expect(201);
    expect(unassigned.body.data).toMatchObject({ managedBy: null, association: null });
    const notManager = await kaluppa.post('/api/farms').send(farm({ lotNumber: 'X', managedById: String(ana.user._id) }));
    expect(notManager.body.errors).toHaveProperty('managedById');
    ids.kalManaged = managed.body.data.id;
    ids.kalOpen = unassigned.body.data.id;
  });
});

describe('who sees which farms', () => {
  it('a farmer lists only their own', async () => {
    expect(lots(await listOf(ana.agent))).toEqual(['GM 1', 'Lot 1', 'Lot 7']);
    expect(lots(await listOf(nina.agent))).toEqual(['Nina 1']);
    expect((await ana.agent.get(`/api/farms/${ids.ben}`)).status).toBe(404);
  });

  it('a Group Manager lists its association’s farms and the Kaluppa farm it manages, never another association’s', async () => {
    expect(lots(await listOf(manager))).toEqual(['GM 1', 'Kaluppa Demo Farm', 'Lot 1', 'Lot 7']);
    expect(lots(await listOf(boacManager))).toEqual(['Lot 1']);
    expect((await manager.get(`/api/farms/${ids.ben}`)).status).toBe(404);
    expect((await manager.get(`/api/farms/${ids.kalOpen}`)).status).toBe(404);
  });

  it('Kaluppa lists every farm and filters by owner type, town and search', async () => {
    expect(await listOf(kaluppa)).toHaveLength(7);
    expect(lots(await listOf(kaluppa, '?ownerType=kaluppa'))).toEqual(['Kaluppa Demo Farm', 'Torrijos Nursery']);
    expect(lots(await listOf(kaluppa, '?municipality=Boac'))).toEqual(['Lot 1']);
    expect(lots(await listOf(kaluppa, '?q=matalaba'))).toEqual(['Lot 7']);
  });

  it('a Group Manager filters by farmer', async () => {
    expect(lots(await listOf(manager, `?farmerId=${ana.user._id}`))).toEqual(['GM 1', 'Lot 1', 'Lot 7']);
  });
});

describe('editing', () => {
  const patch = (agent, id, fields) => agent.patch(`/api/farms/${id}`).send(farm(fields));

  it('owners and their Group Manager edit farmer farms; Kaluppa can’t (403)', async () => {
    expect((await patch(ana.agent, ids.anaLot7, { lotNumber: 'Lot 7', sizeHa: 0.8 })).body.data.sizeHa).toBe(0.8);
    expect((await patch(manager, ids.anaLot7, { lotNumber: 'Lot 7', sizeHa: 0.9 })).status).toBe(200);
    expect((await patch(kaluppa, ids.anaLot7, { lotNumber: 'Lot 7' })).status).toBe(403);
    expect((await patch(ben.agent, ids.anaLot7, { lotNumber: 'Lot 7' })).status).toBe(404);
  });

  it('only Kaluppa edits Kaluppa farms; the managing Group Manager sees canEdit false', async () => {
    expect((await patch(kaluppa, ids.kalManaged, { lotNumber: 'Kaluppa Demo Farm', sizeHa: 3.5 })).body.data.sizeHa).toBe(3.5);
    expect((await patch(manager, ids.kalManaged, { lotNumber: 'Kaluppa Demo Farm' })).status).toBe(403);
    const seen = (await manager.get(`/api/farms/${ids.kalManaged}`)).body.data;
    expect(seen).toMatchObject({ canEdit: false, canAssignFarmers: true });
  });
});

describe('assigned farmers on a Kaluppa farm', () => {
  const put = (agent, id, farmerIds) => agent.put(`/api/farms/${id}/assigned-farmers`).send({ farmerIds });

  it('only the managing Group Manager changes the list, with its own approved farmers', async () => {
    const res = await put(manager, ids.kalManaged, [String(ana.user._id)]).expect(200);
    expect(res.body.data.assignedFarmers).toEqual([{ id: String(ana.user._id), name: 'Ana Farmer' }]);
    expect((await put(manager, ids.kalManaged, [String(ben.user._id)])).body.errors).toHaveProperty('farmerIds');
    expect((await put(kaluppa, ids.kalManaged, [])).status).toBe(403);
    expect((await put(boacManager, ids.kalManaged, [])).status).toBe(404);
    expect((await put(manager, ids.anaLot1, [])).status).toBe(403); // farmer farms have no assigned farmers
  });
});

describe('archive and restore', () => {
  it('archive moves a farm to Archived; its lot number can be reused; restore clashes politely', async () => {
    await ana.agent.post(`/api/farms/${ids.anaLot1}/archive`).expect(200);
    expect(lots(await listOf(ana.agent, '?status=archived'))).toEqual(['Lot 1']);
    expect(lots(await listOf(ana.agent))).toEqual(['GM 1', 'Lot 7']);
    const reused = await ana.agent.post('/api/farms').send(farm()).expect(201);
    expect((await ana.agent.post(`/api/farms/${ids.anaLot1}/restore`)).status).toBe(409);
    await ana.agent.post(`/api/farms/${reused.body.data.id}/archive`).expect(200);
    const restored = await ana.agent.post(`/api/farms/${ids.anaLot1}/restore`).expect(200);
    expect(restored.body.data.status).toBe('active');
    expect((await ana.agent.patch(`/api/farms/${reused.body.data.id}`).send(farm({ lotNumber: 'Again' }))).status).toBe(409); // restore it first
  });

  it('every change is in the audit log', async () => {
    const actions = await AuditLog.distinct('action', { area: 'farms' });
    expect(actions.sort()).toEqual(['archive', 'assign_farmers', 'create', 'restore', 'update']);
    const entry = await AuditLog.findOne({ area: 'farms', action: 'update', entityId: ids.anaLot7 }).sort({ at: 1 }).lean();
    expect(entry.changes).toEqual(expect.arrayContaining([{ field: 'sizeHa', from: 1.2, to: 0.8 }]));
  });
});

describe('records follow the farmer’s association', () => {
  it('a removed farmer’s farms leave the association with them', async () => {
    await manager.post(`/api/farmers/${ana.user._id}/remove`).send({ reason: 'Moved away from Santa Cruz' }).expect(200);
    expect(lots(await listOf(manager))).toEqual(['Kaluppa Demo Farm']);
    expect((await listOf(ana.agent)).every((f) => f.association === null)).toBe(true);
  });
});
