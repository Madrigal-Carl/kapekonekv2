import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { documentsOf, registerFarmer, setUpAssociations, signedIn } from './helpers/farmers.js';

const mail = vi.hoisted(() => []);
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }) }));
vi.mock('../src/clients/cloudinary.client.js', () => ({
  getUploadedAsset: vi.fn(async (publicId) => (publicId.endsWith('land')
    ? { bytes: 2_000_000, format: 'pdf', resourceType: 'image', originalFilename: 'land' }
    : { bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: 'id' })),
  destroyImage: vi.fn(),
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, Conversation, ConversationMember, FarmerProfile, Notification, User } = await import('../src/models/index.js');
const { directKey } = await import('../src/services/chat.service.js');

let associations;
let santacruzManager;
let boacManager;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  associations = await setUpAssociations(app, User);
  santacruzManager = await signedIn(app, 'manager.santacruz');
  boacManager = await signedIn(app, 'manager.unassigned');
});
afterAll(stopMemoryDb);
beforeEach(() => { mail.length = 0; });

const member = (conversation, user) => ConversationMember.findOne({ conversation, user }).lean();
const ask = (agent, user, association, docs = documentsOf(user._id)) =>
  agent.post('/api/me/farmer-profile/request').send({ associationId: association.id, ...docs });

describe('farmer sign-up', () => {
  it('creates a FarmerProfile and a Kaluppa chat', async () => {
    const { agent, user } = await registerFarmer(app, User, 'ana');
    const res = await agent.get('/api/me/farmer-profile');
    expect(res.body.data).toMatchObject({ status: 'none', association: null, transferRequest: null });
    expect(await Conversation.exists({ pairKey: `kaluppa:${user._id}` })).toBeTruthy();
    expect((await agent.get('/api/auth/me')).body.data.user).toMatchObject({ farmerStatus: 'none', associationId: null });
  });
});

describe('association requests', () => {
  it('need an association and both documents from the farmer’s own folder', async () => {
    const { agent, user } = await registerFarmer(app, User, 'ben');
    const missing = await agent.post('/api/me/farmer-profile/request').send({ associationId: associations.santacruz.id, validId: documentsOf(user._id).validId });
    expect(Object.keys(missing.body.errors)).toEqual(['landProof']);
    const stranger = await ask(agent, user, associations.santacruz, { ...documentsOf(user._id), validId: documentsOf('someoneelse').validId });
    expect(stranger.status).toBe(400);
    expect(Object.keys(stranger.body.errors)).toEqual(['validId']);

    const res = await ask(agent, user, associations.santacruz);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'pending', association: { id: associations.santacruz.id, name: 'Santa Cruz Growers' } });
    expect(res.body.data.documents.landProof).toMatchObject({ kind: 'pdf', bytes: 2_000_000 });
    expect((await ask(agent, user, associations.santacruz)).status).toBe(409);

    const manager = await User.findOne({ username: 'manager.santacruz' });
    expect(await Notification.exists({ user: manager._id, type: 'farmer_request' })).toBeTruthy();
    expect(mail.find((m) => m.job === 'farmer-request').data).toMatchObject({ to: manager.email, farmerName: 'Ben Farmer', associationName: 'Santa Cruz Growers' });
  });

  it('go to Kaluppa when the association has no Group Manager', async () => {
    const { agent, user } = await registerFarmer(app, User, 'cora');
    await ask(agent, user, associations.gasan).expect(200);
    const kaluppa = await User.findOne({ username: 'kaluppa' });
    expect(await Notification.exists({ user: kaluppa._id, type: 'farmer_request' })).toBeTruthy();
  });

  it('are decided once, only by the association’s own Group Manager', async () => {
    const { agent, user } = await registerFarmer(app, User, 'dino');
    await ask(agent, user, associations.santacruz).expect(200);
    expect((await boacManager.post(`/api/farmers/${user._id}/approve`)).status).toBe(404);

    const results = await Promise.all([1, 2].map(() => santacruzManager.post(`/api/farmers/${user._id}/approve`)));
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await member(associations.santacruz.groupChat, user._id)).toMatchObject({ canPost: true });
    expect(await Notification.exists({ user: user._id, type: 'farmer_decision' })).toBeTruthy();
    expect(mail.filter((m) => m.job === 'farmer-decision').map((m) => m.data.approved)).toEqual([true]);
    expect((await agent.get('/api/auth/me')).body.data.user).toMatchObject({ farmerStatus: 'approved', associationId: associations.santacruz.id });
    // The account page shows who runs the association, how many farmers it has and who approved.
    expect((await agent.get('/api/me/farmer-profile')).body.data).toMatchObject({
      association: { groupManager: { id: expect.any(String), name: 'Liza Ramos', contactNumber: null }, farmers: expect.any(Number) },
      approvedBy: { name: 'Liza Ramos' },
    });
    // The association window names each association's Group Manager.
    const options = (await agent.get('/api/associations/options')).body.data;
    expect(options.find((o) => o.id === associations.santacruz.id).groupManager).toEqual({ name: 'Liza Ramos' });
  });

  it('rejection needs a reason the farmer sees, and they can ask again', async () => {
    const { agent, user } = await registerFarmer(app, User, 'eli');
    await ask(agent, user, associations.boac).expect(200);
    expect((await boacManager.post(`/api/farmers/${user._id}/reject`).send({ reason: 'no' })).status).toBe(400);
    await boacManager.post(`/api/farmers/${user._id}/reject`).send({ reason: 'Your land proof is unreadable.' }).expect(200);
    expect((await agent.get('/api/me/farmer-profile')).body.data).toMatchObject({ status: 'rejected', rejectionReason: 'Your land proof is unreadable.' });
    expect(mail.find((m) => m.job === 'farmer-decision').data).toMatchObject({ approved: false, reason: 'Your land proof is unreadable.' });
    expect((await ask(agent, user, associations.boac)).body.data).toMatchObject({ status: 'pending', rejectionReason: null });
  });
});

describe('transfers and removal', () => {
  let farmer;
  beforeAll(async () => {
    farmer = await registerFarmer(app, User, 'fern');
    await ask(farmer.agent, farmer.user, associations.santacruz).expect(200);
    await santacruzManager.post(`/api/farmers/${farmer.user._id}/approve`).expect(200);
  });

  it('a transfer keeps the farmer in the old association until the new Group Manager approves', async () => {
    const coFarmer = await User.findOne({ username: 'dino' });
    const direct = await Conversation.create({ type: 'direct', pairKey: directKey(farmer.user._id, coFarmer._id) });
    await ConversationMember.create([{ conversation: direct._id, user: farmer.user._id }, { conversation: direct._id, user: coFarmer._id }]);

    await farmer.agent.post('/api/me/farmer-profile/transfer').send({ associationId: associations.boac.id, reason: 'Moved to Boac' }).expect(200);
    await farmer.agent.delete('/api/me/farmer-profile/transfer').expect(200);
    expect((await farmer.agent.get('/api/me/farmer-profile')).body.data.transferRequest).toBeNull();
    const res = await farmer.agent.post('/api/me/farmer-profile/transfer').send({ associationId: associations.boac.id });
    expect(res.body.data).toMatchObject({ status: 'approved', association: { id: associations.santacruz.id }, transferRequest: { association: { id: associations.boac.id } } });

    expect((await santacruzManager.post(`/api/farmers/${farmer.user._id}/transfer/approve`)).status).toBe(404);
    await boacManager.post(`/api/farmers/${farmer.user._id}/transfer/approve`).expect(200);
    expect((await farmer.agent.get('/api/me/farmer-profile')).body.data).toMatchObject({ status: 'approved', association: { id: associations.boac.id }, transferRequest: null });
    expect(await member(associations.santacruz.groupChat, farmer.user._id)).toMatchObject({ canPost: false });
    expect(await member(direct._id, coFarmer._id)).toMatchObject({ canPost: false });
    expect(await member(associations.boac.groupChat, farmer.user._id)).toMatchObject({ canPost: true });
    expect(mail.find((m) => m.job === 'transfer-decision').data).toMatchObject({ approved: true, associationName: 'Boac Growers' });
  });

  it('removal leaves the farmer unaffiliated, with read-only chats', async () => {
    const managerUser = await User.findOne({ username: 'manager.unassigned' });
    const direct = await Conversation.create({ type: 'direct', pairKey: directKey(farmer.user._id, managerUser._id) });
    await ConversationMember.create([{ conversation: direct._id, user: farmer.user._id }, { conversation: direct._id, user: managerUser._id }]);
    expect((await boacManager.post(`/api/farmers/${farmer.user._id}/remove`).send({})).status).toBe(400);
    await boacManager.post(`/api/farmers/${farmer.user._id}/remove`).send({ reason: 'Left the cooperative.' }).expect(200);
    expect(await FarmerProfile.findOne({ user: farmer.user._id }).lean()).toMatchObject({ status: 'none', association: null, approvedAt: null });
    expect(await member(associations.boac.groupChat, farmer.user._id)).toMatchObject({ canPost: false });
    expect(await member(direct._id, farmer.user._id)).toMatchObject({ canPost: false });
  });

  it('audits every step, never the documents', async () => {
    const entries = await AuditLog.find({ area: 'farmers', entityId: farmer.user._id }).sort({ _id: 1 }).lean();
    expect(entries.map((e) => e.action)).toEqual(['request', 'approve', 'transfer_request', 'transfer_withdraw', 'transfer_request', 'transfer_approve', 'remove']);
    expect(entries.flatMap((e) => e.changes.map((c) => c.field))).not.toContain('documents');
  });
});
