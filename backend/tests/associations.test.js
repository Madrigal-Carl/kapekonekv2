import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, Conversation, ConversationMember, FarmerProfile, User } = await import('../src/models/index.js');

async function signedIn(local) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: `kapekonek.${local}@gmail.com`, password: 'KapeKonek@123' }).expect(200);
  return agent;
}

let kaluppa;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  kaluppa = await signedIn('kaluppa');
});
afterAll(stopMemoryDb);
beforeEach(() => AuditLog.deleteMany({}));

const create = (body) => kaluppa.post('/api/associations').send({ municipality: 'Boac', description: '', ...body });

describe('associations', () => {
  it('creates one with its group chat, and audits it', async () => {
    const res = await create({ name: 'Boac Highland Growers', description: 'Meets every first Monday.' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: 'Boac Highland Growers', slug: 'boac-highland-growers', municipality: 'Boac', groupManager: null, status: 'active' });
    expect(await Conversation.exists({ _id: res.body.data.groupChat, type: 'group', association: res.body.data.id })).toBeTruthy();
    expect(await AuditLog.countDocuments({ area: 'associations', action: 'create', entityId: res.body.data.id })).toBe(1);
  });

  it('keeps names unique and validates', async () => {
    const dup = await create({ name: 'boac highland growers' });
    expect(dup.status).toBe(409);
    expect(dup.body.errors).toEqual({ name: 'An association with this name already exists' });
    const bad = await create({ name: 'B', municipality: 'Manila', description: 'x'.repeat(501) });
    expect(Object.keys(bad.body.errors).sort()).toEqual(['description', 'municipality', 'name']);
  });

  it('lists with search, status and municipality filters, page by page', async () => {
    await create({ name: 'Gasan Coffee Circle', municipality: 'Gasan' });
    const res = await kaluppa.get('/api/associations?q=gasan&status=active&municipality=Gasan&page=1&limit=10');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 10, total: 1 });
    expect(res.body.data[0]).toMatchObject({ name: 'Gasan Coffee Circle', farmerCount: 0, waitingCount: 0, groupManager: null });
    expect((await kaluppa.get('/api/associations?status=archived')).body.meta.total).toBe(0);
  });

  it('updates name, municipality and description', async () => {
    const { id } = (await create({ name: 'Mogpog Growers', municipality: 'Mogpog' })).body.data;
    const res = await kaluppa.patch(`/api/associations/${id}`).send({ name: 'Mogpog Coffee Growers', municipality: 'Mogpog', description: 'New' });
    expect(res.body.data).toMatchObject({ name: 'Mogpog Coffee Growers', slug: 'mogpog-coffee-growers', description: 'New' });
    const entry = await AuditLog.findOne({ action: 'update', entityId: id }).lean();
    expect(entry.changes.map((c) => c.field).sort()).toEqual(['description', 'name']);
  });

  it('archives only when it has no farmers and no Group Manager; its chat turns read-only', async () => {
    const manager = await User.findOne({ username: 'manager.unassigned' });
    const { id, groupChat } = (await create({ name: 'Torrijos Growers', municipality: 'Torrijos', groupManagerId: String(manager._id) })).body.data;

    const withManager = await kaluppa.post(`/api/associations/${id}/archive`);
    expect(withManager.status).toBe(409);
    expect(withManager.body.message).toMatch(/Group Manager/);

    await kaluppa.patch(`/api/associations/${id}`).send({ name: 'Torrijos Growers', municipality: 'Torrijos', description: '', groupManagerId: null });
    const farmer = await User.findOne({ username: 'farmer.approved' });
    await FarmerProfile.updateOne({ user: farmer._id }, { association: id, status: 'approved' }, { upsert: true });
    const withFarmers = await kaluppa.post(`/api/associations/${id}/archive`);
    expect(withFarmers.status).toBe(409);
    expect(withFarmers.body.message).toMatch(/1 farmer/);

    await FarmerProfile.updateOne({ user: farmer._id }, { association: null, status: 'none' });
    const res = await kaluppa.post(`/api/associations/${id}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('archived');
    expect(await ConversationMember.countDocuments({ conversation: groupChat, canPost: true })).toBe(0);
    expect((await kaluppa.post(`/api/associations/${id}/restore`)).body.data.status).toBe('active');
    expect(await AuditLog.countDocuments({ entityId: id, action: { $in: ['archive', 'restore'] } })).toBe(2);
  });

  it('offers active associations to every signed-in user, and the rest only to Kaluppa', async () => {
    const farmer = await signedIn('farmer.approved');
    const options = await farmer.get('/api/associations/options');
    expect(options.status).toBe(200);
    expect(options.body.data[0]).toEqual({ id: expect.any(String), name: expect.any(String), municipality: expect.any(String) });
    expect((await farmer.get('/api/associations')).status).toBe(403);
    const manager = await signedIn('manager.santacruz');
    expect((await manager.post('/api/associations').send({ name: 'Nope', municipality: 'Boac' })).status).toBe(403);
    expect((await request(app).get('/api/associations/options')).status).toBe(401);
  });
});
