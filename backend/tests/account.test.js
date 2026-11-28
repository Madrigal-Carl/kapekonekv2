import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const mail = vi.hoisted(() => []);
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({
  enqueueEmail: vi.fn(async (job, data) => { mail.push({ job, data }); }),
}));
vi.mock('../src/clients/cloudinary.client.js', () => ({
  destroyImage: vi.fn(async () => {}),
  getUploadedAsset: vi.fn(async () => ({ bytes: 400_000, format: 'jpg', resourceType: 'image', originalFilename: 'me' })),
}));

const { getValkey } = await import('../src/config/valkey.js');
const { destroyImage, getUploadedAsset } = await import('../src/clients/cloudinary.client.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User } = await import('../src/models/index.js');

const PASSWORD = 'KapeKonek@123';
const lastMail = (job) => mail.findLast((m) => m.job === job);
const cookie = (res, name) => res.headers['set-cookie']?.find((c) => c.startsWith(`${name}=`));

async function signedIn(identifier, { password = PASSWORD, remember = false } = {}) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ identifier, password, remember }).expect(200);
  return agent;
}

/** A fresh verified buyer, so tests that change credentials don't touch each other. */
async function freshBuyer(name) {
  await request(app)
    .post('/api/auth/register')
    .send({ firstName: 'Ana', lastName: 'Reyes', username: name, email: `${name}@example.com`, password: PASSWORD, role: 'buyer', acceptTerms: true })
    .expect(201);
  const user = await User.findOneAndUpdate({ username: name }, { emailVerifiedAt: new Date() }, { returnDocument: 'after' });
  mail.length = 0;
  return { user, agent: await signedIn(name) };
}

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  mail.length = 0;
  await getValkey().flushall();
});

describe('guards', () => {
  it('guests get 401 and unverified buyers 403 EMAIL_NOT_VERIFIED; unverified farmers too (Phase 2)', async () => {
    expect((await request(app).get('/api/account/profile')).status).toBe(401);
    const pedro = await signedIn('buyer.unverified');
    const res = await pedro.patch('/api/account/profile').send({ firstName: 'Pedro', lastName: 'Lopez', username: 'buyer.unverified' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    const nora = await signedIn('farmer.unverified');
    expect((await nora.get('/api/account/profile')).body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('profile', () => {
  it('updates names, username and phone (spaces stripped, blank clears it)', async () => {
    const { agent } = await freshBuyer('profileok');
    const res = await agent
      .patch('/api/account/profile')
      .send({ firstName: 'Ana', middleName: 'Cruz', lastName: 'Reyes', username: 'ana.reyes', contactNumber: '0917 123 4567' })
      .expect(200);
    expect(res.body.data).toMatchObject({ fullName: 'Ana Cruz Reyes', username: 'ana.reyes', contactNumber: '09171234567' });
    const cleared = await agent.patch('/api/account/profile').send({ firstName: 'Ana', middleName: '', lastName: 'Reyes', username: 'ana.reyes', contactNumber: '' });
    expect(cleared.body.data).toMatchObject({ middleName: null, contactNumber: null });
  });

  it('refuses a taken username with 409 and a field error; keeping your own is fine', async () => {
    const { agent } = await freshBuyer('profiletaken');
    const taken = await agent.patch('/api/account/profile').send({ firstName: 'Ana', lastName: 'Reyes', username: 'buyer' });
    expect(taken.status).toBe(409);
    expect(taken.body.errors).toEqual({ username: 'Username is already taken' });
    await agent.patch('/api/account/profile').send({ firstName: 'Ana', lastName: 'Reyes', username: 'profiletaken' }).expect(200);
  });

  it('validates fields with the shared rules', async () => {
    const { agent } = await freshBuyer('profilebad');
    const res = await agent.patch('/api/account/profile').send({ firstName: '', lastName: 'Reyes', username: 'No Caps', contactNumber: '12345' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['contactNumber', 'firstName', 'username']);
  });
});

describe('avatar', () => {
  const upload = (userId, name) => ({
    url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/avatars/${userId}/${name}.jpg`,
    publicId: `kapekonek/avatars/${userId}/${name}`,
  });

  it('sets an own upload, deletes the replaced one, and removes it', async () => {
    const { user, agent } = await freshBuyer('avatarok');
    destroyImage.mockClear();
    const first = await agent.patch('/api/account/avatar').send(upload(user._id, 'a')).expect(200);
    expect(first.body.data.avatar).toEqual({ url: upload(user._id, 'a').url });
    expect(destroyImage).not.toHaveBeenCalled();

    await agent.patch('/api/account/avatar').send(upload(user._id, 'b')).expect(200);
    expect(destroyImage).toHaveBeenCalledWith(upload(user._id, 'a').publicId);

    const removed = await agent.delete('/api/account/avatar').expect(200);
    expect(removed.body.data.avatar).toBeNull();
    expect(destroyImage).toHaveBeenLastCalledWith(upload(user._id, 'b').publicId);
  });

  it("refuses someone else's upload or another folder", async () => {
    const { user, agent } = await freshBuyer('avatarbad');
    const other = await User.findOne({ username: 'buyer' });
    expect((await agent.patch('/api/account/avatar').send(upload(other._id, 'x'))).status).toBe(400);
    const receipt = { url: `https://res.cloudinary.com/test/image/upload/v1/kapekonek/receipts/${user._id}/r.jpg`, publicId: `kapekonek/receipts/${user._id}/r` };
    expect((await agent.patch('/api/account/avatar').send(receipt)).body.errors).toEqual({ avatar: 'Upload your photo again.' });
    // Exactly 5 MB passes; one byte more is deleted and refused.
    getUploadedAsset.mockResolvedValueOnce({ bytes: 5 * 1024 * 1024, format: 'png', resourceType: 'image', originalFilename: 'five' });
    await agent.patch('/api/account/avatar').send(upload(user._id, 'five')).expect(200);
    getUploadedAsset.mockResolvedValueOnce({ bytes: 5 * 1024 * 1024 + 1, format: 'png', resourceType: 'image', originalFilename: 'over' });
    const over = await agent.patch('/api/account/avatar').send(upload(user._id, 'over'));
    expect(over.status).toBe(422);
    expect(over.body.code).toBe('FILE_TOO_LARGE');
    expect(destroyImage).toHaveBeenLastCalledWith(upload(user._id, 'over').publicId);
  });
});

describe('change email', () => {
  it('needs the current password', async () => {
    const { agent } = await freshBuyer('emailpw');
    const res = await agent.patch('/api/account/email').send({ email: 'new.emailpw@example.com', currentPassword: 'wrong' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({ currentPassword: 'Your current password is incorrect' });
    expect(mail).toHaveLength(0);
  });

  it('refuses a taken email and your own email', async () => {
    const { agent } = await freshBuyer('emailtaken');
    const taken = await agent.patch('/api/account/email').send({ email: 'kapekonek.buyer@gmail.com', currentPassword: PASSWORD });
    expect(taken.status).toBe(409);
    expect(taken.body.errors).toEqual({ email: 'Email is already taken' });
    const same = await agent.patch('/api/account/email').send({ email: 'emailtaken@example.com', currentPassword: PASSWORD });
    expect(same.body.errors).toEqual({ email: 'That is already your email' });
  });

  it('unverifies, emails a link to the new address and a notice to the old, and the link verifies it', async () => {
    const { agent } = await freshBuyer('emailflow');
    const res = await agent.patch('/api/account/email').send({ email: 'Moved.Here@Example.com', currentPassword: PASSWORD }).expect(200);
    expect(res.body.data.user).toMatchObject({ email: 'moved.here@example.com', emailVerifiedAt: null });

    const verify = lastMail('verify-email');
    expect(verify.data.to).toBe('moved.here@example.com');
    expect(lastMail('email-changed-notice').data).toMatchObject({ to: 'emailflow@example.com', newEmail: 'moved.here@example.com' });

    // Unverified buyer again: buyer actions are blocked until the new address is verified.
    expect((await agent.get('/api/account/profile')).body.code).toBe('EMAIL_NOT_VERIFIED');

    const token = new URL(verify.data.url).searchParams.get('token');
    await request(app).post('/api/auth/email/verify').send({ token }).expect(200);
    expect((await agent.get('/api/account/profile')).body.data.email).toBe('moved.here@example.com');
    await signedIn('moved.here@example.com');
  });
});

describe('change password', () => {
  it('needs the current password and the password rule', async () => {
    const { agent } = await freshBuyer('pwrules');
    const wrong = await agent.patch('/api/account/password').send({ currentPassword: 'nope', password: 'NewPass456!' });
    expect(wrong.body.errors).toEqual({ currentPassword: 'Your current password is incorrect' });
    const weak = await agent.patch('/api/account/password').send({ currentPassword: PASSWORD, password: 'short' });
    expect(Object.keys(weak.body.errors)).toEqual(['password']);
  });

  it('bumps tokenVersion: this session stays (same remember choice), other sessions are signed out', async () => {
    const { user } = await freshBuyer('pwflow');
    const here = await signedIn('pwflow', { remember: true });
    const other = await signedIn('pwflow');

    const res = await here.patch('/api/account/password').send({ currentPassword: PASSWORD, password: 'NewPass456!' }).expect(200);
    expect((await User.findById(user._id)).tokenVersion).toBe(user.tokenVersion + 1);
    expect(cookie(res, 'refreshToken')).toMatch(/Max-Age=2592000/);

    await here.get('/api/auth/me').expect(200);
    await here.post('/api/auth/refresh').expect(200);
    expect((await other.get('/api/auth/me')).status).toBe(401);
    expect((await other.post('/api/auth/refresh')).status).toBe(401);

    expect((await request(app).post('/api/auth/login').send({ identifier: 'pwflow', password: PASSWORD })).status).toBe(401);
    await signedIn('pwflow', { password: 'NewPass456!' });
  });

  it('caps current-password guesses at 5 a minute', async () => {
    const { agent } = await freshBuyer('pwlimit');
    for (let i = 0; i < 5; i += 1) await agent.patch('/api/account/password').send({ currentPassword: 'nope', password: 'NewPass456!' });
    expect((await agent.patch('/api/account/password').send({ currentPassword: PASSWORD, password: 'NewPass456!' })).status).toBe(429);
  });
});
