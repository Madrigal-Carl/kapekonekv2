import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const mail = vi.hoisted(() => []);
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { AuditLog, Conversation, ConversationMember, FarmerProfile, User } = await import('../src/models/index.js');
const { directKey } = await import('../src/services/chat.service.js');

async function signedIn(local) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier: `kapekonek.${local}@gmail.com`, password: 'KapeKonek@123' }).expect(200);
  return agent;
}
const member = (conversation, user) => ConversationMember.findOne({ conversation, user }).lean();

let kaluppa;
let boac;
let gasan;
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  kaluppa = await signedIn('kaluppa');
  boac = (await kaluppa.post('/api/associations').send({ name: 'Boac Growers', municipality: 'Boac' })).body.data;
  gasan = (await kaluppa.post('/api/associations').send({ name: 'Gasan Growers', municipality: 'Gasan' })).body.data;
});
afterAll(stopMemoryDb);
beforeEach(() => { mail.length = 0; });

const lena = { firstName: 'Lena', lastName: 'Ramos', username: 'lena.ramos', email: 'lena.ramos@example.com', contactNumber: '09175550111' };

describe('Group Managers', () => {
  it('creates one with the default password, a verification email, a Kaluppa chat and the association’s group chat', async () => {
    const res = await kaluppa.post('/api/group-managers').send({ ...lena, associationId: boac.id });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ username: 'lena.ramos', status: 'active', association: { id: boac.id, name: 'Boac Growers' } });
    const lenaUser = await User.findOne({ username: 'lena.ramos' }).lean();
    expect(lenaUser).toMatchObject({ roles: ['group_manager'], createdBy: expect.anything(), emailVerifiedAt: null, passwordIsDefault: true });

    const created = mail.find((m) => m.job === 'account-created');
    expect(created.data).toMatchObject({ to: 'lena.ramos@example.com', name: 'Lena', creatorName: 'Kaluppa', password: 'KapeKonek@123' });
    expect(created.data.url).toMatch(/\/verify-email\/confirm\?token=[a-f0-9]{64}$/);
    // Until the email is verified, the dashboard is closed to them.
    const lenaAgent = request.agent(app);
    const signIn = await lenaAgent.post('/api/auth/login').send({ identifier: 'lena.ramos', password: 'KapeKonek@123' }).expect(200);
    expect(signIn.body.data.user).toMatchObject({ mustVerifyEmail: true, createdBy: { name: 'Kaluppa', isKaluppa: true } });
    expect((await lenaAgent.get('/api/farmers')).body.code).toBe('EMAIL_NOT_VERIFIED');

    expect(await Conversation.exists({ pairKey: `kaluppa:${lenaUser._id}` })).toBeTruthy();
    expect(await member(boac.groupChat, lenaUser._id)).toMatchObject({ canPost: true });
    expect((await kaluppa.get(`/api/associations/${boac.id}`)).body.data.groupManager).toMatchObject({ id: String(lenaUser._id), name: 'Lena Ramos' });
    expect(await AuditLog.countDocuments({ area: 'group_managers', action: 'create' })).toBe(1);
  });

  it('refuses a taken username with 409 USERNAME_TAKEN', async () => {
    const res = await kaluppa.post('/api/group-managers').send({ ...lena, username: 'manager.santacruz', email: 'lena9@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
    expect(res.body.errors.username).toBe('Username is already taken');
  });

  it('needs an email, and allows one Group Manager per association', async () => {
    const noEmail = await kaluppa.post('/api/group-managers').send({ ...lena, username: 'lena2', email: '' });
    expect(noEmail.status).toBe(400);
    expect(noEmail.body.errors.email).toBeDefined();
    const taken = await kaluppa.post('/api/group-managers').send({ ...lena, username: 'lena3', email: 'lena3@example.com', associationId: boac.id });
    expect(taken.status).toBe(409);
    expect(taken.body.errors).toEqual({ associationId: 'Boac Growers already has a Group Manager' });
  });

  it('moving makes the old group chat and old farmer chats read-only, and joins the new one', async () => {
    const lenaUser = await User.findOne({ username: 'lena.ramos' });
    const farmer = await User.findOne({ username: 'farmer.approved' });
    await FarmerProfile.updateOne({ user: farmer._id }, { association: boac.id, status: 'approved' }, { upsert: true });
    const direct = await Conversation.create({ type: 'direct', pairKey: directKey(lenaUser._id, farmer._id) });
    await ConversationMember.create([{ conversation: direct._id, user: lenaUser._id }, { conversation: direct._id, user: farmer._id }]);

    const res = await kaluppa.patch(`/api/group-managers/${lenaUser._id}`).send({ ...lena, associationId: gasan.id });
    expect(res.status).toBe(200);
    // The view drawer shows the association's waiting requests and the last sign-in.
    expect(res.body.data).toMatchObject({ association: { id: gasan.id, farmerCount: 0, waitingCount: 0 }, lastSignInAt: expect.any(String) }); // she signed in above
    expect(await member(boac.groupChat, lenaUser._id)).toMatchObject({ canPost: false });
    expect(await member(direct._id, farmer._id)).toMatchObject({ canPost: false });
    expect(await member(gasan.groupChat, lenaUser._id)).toMatchObject({ canPost: true });
    expect((await kaluppa.get(`/api/associations/${boac.id}`)).body.data.groupManager).toBeNull();
    const entry = await AuditLog.findOne({ area: 'group_managers', action: 'update' }).lean();
    expect(entry.changes).toEqual([{ field: 'association', from: 'Boac Growers', to: 'Gasan Growers' }]);
  });

  it('archiving suspends the account, ends open sessions and frees the association', async () => {
    const santacruz = await User.findOne({ username: 'manager.santacruz' });
    await kaluppa.patch(`/api/group-managers/${santacruz._id}`).send({
      firstName: santacruz.firstName, lastName: santacruz.lastName, username: santacruz.username, email: santacruz.email,
      contactNumber: '09175550112', associationId: boac.id,
    }).expect(200);
    const session = await signedIn('manager.santacruz');
    expect((await session.get('/api/auth/me')).body.data.user.associationId).toBe(boac.id);

    const res = await kaluppa.post(`/api/group-managers/${santacruz._id}/archive`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'archived', association: null });
    expect(await User.findById(santacruz._id).lean()).toMatchObject({ status: 'suspended', tokenVersion: santacruz.tokenVersion + 1 });
    expect((await session.get('/api/auth/me')).status).toBe(401);
    expect((await kaluppa.get(`/api/associations/${boac.id}`)).body.data.groupManager).toBeNull();
    expect(await member(boac.groupChat, santacruz._id)).toMatchObject({ canPost: false });

    expect((await kaluppa.post(`/api/group-managers/${santacruz._id}/restore`)).body.data).toMatchObject({ status: 'unassigned' });
    expect(await AuditLog.countDocuments({ area: 'group_managers', entityId: santacruz._id, action: { $in: ['archive', 'restore'] } })).toBe(2);
  });

  it('lists with the status filter and search', async () => {
    const res = await kaluppa.get('/api/group-managers?status=unassigned&q=santa');
    expect(res.status).toBe(200);
    expect(res.body.data.map((g) => g.username)).toEqual(['manager.santacruz']);
    expect(res.body.data[0]).toMatchObject({ name: expect.any(String), initials: expect.any(String), contactNumber: '09175550112', createdAt: expect.any(String) });
  });

  it('is Kaluppa-only', async () => {
    const manager = await signedIn('manager.unassigned');
    expect((await manager.get('/api/group-managers')).status).toBe(403);
    expect((await (await signedIn('farmer.approved')).post('/api/group-managers').send(lena)).status).toBe(403);
  });
});
