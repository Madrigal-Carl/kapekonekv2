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
const { AuditLog, ConversationMember, User } = await import('../src/models/index.js');

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

const nora = { firstName: 'Nora', lastName: 'Lim', username: 'nora.lim', contactNumber: '09175550150', email: 'nora.lim@example.com' };
const login = (identifier, password) => request(app).post('/api/auth/login').send({ identifier, password });

describe('farmers a Group Manager adds (Change 08)', () => {
  it('needs an email', async () => {
    const res = await manager.post('/api/farmers').send({ ...nora, email: null });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toBeTruthy();
  });

  it('starts with the default password and an unverified email; the dashboard waits for the email', async () => {
    const res = await manager.post('/api/farmers').send(nora);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ username: 'nora.lim', email: 'nora.lim@example.com', status: 'approved', association: { id: associations.santacruz.id } });
    const user = await User.findOne({ username: 'nora.lim' }).lean();
    expect(user).toMatchObject({ emailVerifiedAt: null, passwordIsDefault: true, mustChangePassword: false, createdBy: expect.anything() });
    expect(await member(associations.santacruz.groupChat, user._id)).toMatchObject({ canPost: true });
    expect(mail).toEqual([{ job: 'account-created', data: expect.objectContaining({ to: 'nora.lim@example.com', creatorName: 'Liza Ramos', username: 'nora.lim', password: 'KapeKonek@123' }) }]);

    const signIn = await login('nora.lim', 'KapeKonek@123');
    expect(signIn.status).toBe(200);
    expect(signIn.body.data.user).toMatchObject({ mustVerifyEmail: true, passwordIsDefault: true, createdBy: { name: 'Liza Ramos', isKaluppa: false }, associationName: 'Santa Cruz Growers' });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'nora.lim', password: 'KapeKonek@123' }).expect(200);
    expect((await agent.get('/api/farms')).body.code).toBe('EMAIL_NOT_VERIFIED');
    const entry = await AuditLog.findOne({ area: 'farmers', action: 'create', entityId: user._id }).lean();
    expect(JSON.stringify(entry)).not.toContain('KapeKonek@123');
  });

  it('Reset password: back to the default, signed out everywhere, emailed and audited; only their own Group Manager', async () => {
    const user = await User.findOne({ username: 'nora.lim' });
    await User.updateOne({ _id: user._id }, { $set: { emailVerifiedAt: new Date() } });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'nora.lim', password: 'KapeKonek@123' }).expect(200);
    await agent.patch('/api/account/password').send({ currentPassword: 'KapeKonek@123', password: 'Mine@12345', passwordConfirmation: 'Mine@12345' }).expect(200);
    expect((await User.findById(user._id).lean()).passwordIsDefault).toBe(false);

    const boac = await signedIn(app, 'manager.unassigned'); // runs Boac Growers here
    expect((await boac.post(`/api/farmers/${user._id}/reset-password`)).status).toBe(404);
    expect((await agent.post(`/api/farmers/${user._id}/reset-password`)).status).toBe(403);
    mail.length = 0;
    await manager.post(`/api/farmers/${user._id}/reset-password`).expect(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401); // the old session and its refresh token are gone
    expect((await agent.post('/api/auth/refresh')).status).toBe(401);
    expect((await login('nora.lim', 'KapeKonek@123')).status).toBe(200);
    expect(mail.map((m) => m.job)).toEqual(['password-reset-by-admin']);
    const entry = await AuditLog.findOne({ area: 'farmers', action: 'reset_password', entityId: user._id }).lean();
    expect(entry.changes).toEqual([]);
  });

  it('a new email on edit has to be verified again', async () => {
    const created = await manager.post('/api/farmers').send({ ...nora, username: 'nora.mail', email: 'nora.mail@example.com' });
    const { id } = created.body.data;
    await User.updateOne({ _id: id }, { $set: { emailVerifiedAt: new Date() } });
    mail.length = 0;
    await manager.patch(`/api/farmers/${id}`).send({ ...nora, username: 'nora.mail', email: 'nora.new@example.com' }).expect(200);
    expect((await User.findById(id).lean()).emailVerifiedAt).toBeNull();
    expect(mail.map((m) => m.job)).toEqual(['account-created']);
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

describe('usernames', () => {
  it('refuses a taken username with 409 USERNAME_TAKEN, on add and on edit; keeping your own is fine', async () => {
    const add = await manager.post('/api/farmers').send({ ...nora, username: 'farmer.approved', email: 'other@example.com' });
    expect(add.status).toBe(409);
    expect(add.body.code).toBe('USERNAME_TAKEN');
    expect(add.body.errors).toEqual({ username: 'Username is already taken' });

    const unique = { ...nora, username: 'nora.unique', email: 'nora.unique@example.com', contactNumber: '09175550151' };
    const created = await manager.post('/api/farmers').send(unique);
    expect(created.status).toBe(201);
    const { id } = created.body.data;
    const edit = await manager.patch(`/api/farmers/${id}`).send({ ...unique, username: 'farmer.approved' });
    expect(edit.body.code).toBe('USERNAME_TAKEN');
    expect((await manager.patch(`/api/farmers/${id}`).send(unique)).status).toBe(200);
  });
});
