import request from 'supertest';
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
  getUploadedAsset: vi.fn(async () => ({ bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: 'doc' })),
  destroyImage: vi.fn(),
}));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, ConversationMember, FarmerProfile, User } = await import('../src/models/index.js');

let associations;
let manager;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  associations = await setUpAssociations(app, User);
  manager = await signedIn(app, 'manager.santacruz');
});
afterAll(stopMemoryDb);
beforeEach(() => { mail.length = 0; });

const nora = { firstName: 'Nora', lastName: 'Lim', username: 'nora.lim', contactNumber: '09175550150', email: '' };
const login = (identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });

describe('farmers a Group Manager adds', () => {
  it('without an email: a temporary password shown once, then "Set a new password"', async () => {
    // The dashboard form sends a blank email as null.
    const res = await manager.post('/api/farmers').send({ ...nora, email: null });
    expect(res.status).toBe(201);
    const { farmer, temporaryPassword } = res.body.data;
    expect(temporaryPassword).toMatch(/^.{12}$/);
    expect(farmer).toMatchObject({ username: 'nora.lim', email: null, status: 'approved', association: { id: associations.santacruz.id } });

    const user = await User.findOne({ username: 'nora.lim' }).select('+password').lean();
    expect(user).toMatchObject({ mustChangePassword: true, emailVerifiedAt: expect.any(Date), createdBy: expect.anything() });
    expect(user.password).not.toBe(temporaryPassword);
    expect(await member(associations.santacruz.groupChat, user._id)).toMatchObject({ canPost: true });
    const signIn = await login('nora.lim', temporaryPassword);
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.user.mustChangePassword).toBe(true);

    expect((await manager.get(`/api/farmers/${user._id}`)).body.data.temporaryPassword).toBeUndefined();
    const entry = await AuditLog.findOne({ area: 'farmers', action: 'create', entityId: user._id }).lean();
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword);
    expect(mail).toEqual([]);
  });

  it('with an email: an invite instead of a password', async () => {
    const res = await manager.post('/api/farmers').send({ ...nora, username: 'nora.mail', email: 'nora@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.data.temporaryPassword).toBeUndefined();
    expect(mail.map((m) => m.job)).toEqual(['account-invite']);
    expect(await FarmerProfile.findOne({ user: res.body.data.farmer.id }).lean()).toMatchObject({ status: 'approved' });
  });

  it('can get a new temporary password when there is no email', async () => {
    const user = await User.findOne({ username: 'nora.lim' });
    const res = await manager.patch(`/api/farmers/${user._id}`).send({ ...nora, contactNumber: '09175550151', issueTemporaryPassword: true });
    expect(res.status).toBe(200);
    expect(res.body.data.farmer.contactNumber).toBe('09175550151');
    expect((await login('nora.lim', res.body.data.temporaryPassword)).status).toBe(200);
    const withEmail = await User.findOne({ username: 'nora.mail' });
    expect((await manager.patch(`/api/farmers/${withEmail._id}`).send({ ...nora, username: 'nora.mail', email: 'nora@example.com', issueTemporaryPassword: true })).status).toBe(409);
  });
});

const member = (conversation, user) => ConversationMember.findOne({ conversation, user }).lean();

describe('farmer list', () => {
  it('shows the Group Manager’s association only, with the status filter and search', async () => {
    const { agent, user } = await registerFarmer(app, User, 'waiting');
    await agent.post('/api/me/farmer-profile/request').send({ associationId: associations.santacruz.id, ...documentsOf(user._id) }).expect(200);
    const elsewhere = await registerFarmer(app, User, 'elsewhere');
    await elsewhere.agent.post('/api/me/farmer-profile/request').send({ associationId: associations.boac.id, ...documentsOf(elsewhere.user._id) }).expect(200);

    const all = await manager.get('/api/farmers');
    expect(all.body.data.map((f) => f.username).sort()).toEqual(['nora.lim', 'nora.mail', 'waiting']);
    const waiting = await manager.get('/api/farmers?status=pending&q=wait');
    expect(waiting.body.meta.total).toBe(1);
    expect(waiting.body.data[0]).toMatchObject({ username: 'waiting', status: 'pending', contactNumber: '09175550100' });
    expect((await manager.get(`/api/farmers/${elsewhere.user._id}`)).status).toBe(404);
    expect((await manager.get(`/api/farmers/${user._id}`)).body.data.documents.validId).toMatchObject({ kind: 'image' });

    // Kaluppa narrows to one association (the Associations view drawer); a Group Manager can't widen past its own.
    const kaluppa = await signedIn(app, 'kaluppa');
    const boac = await kaluppa.get(`/api/farmers?associationId=${associations.boac.id}`);
    expect(boac.body.data.map((f) => f.username)).toEqual(['elsewhere']);
    const widened = await manager.get(`/api/farmers?associationId=${associations.boac.id}`);
    expect(widened.body.data.map((f) => f.username).sort()).toEqual(['nora.lim', 'nora.mail', 'waiting']);
  });

  it('is closed to farmers', async () => {
    const { agent } = await registerFarmer(app, User, 'curious');
    expect((await agent.get('/api/farmers')).status).toBe(403);
  });
});
