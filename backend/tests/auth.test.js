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

const { getValkey } = await import('../src/config/valkey.js');
const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User, Token, AuditLog } = await import('../src/models/index.js');

const juana = {
  firstName: 'Juana',
  lastName: 'Santos',
  username: 'juanasantos',
  email: 'Juana.Santos@Example.com',
  password: 'KapeKonek@123',
  role: 'buyer',
  acceptTerms: true,
};
const tokenOf = (url) => new URL(url).searchParams.get('token');
const lastMail = (job) => mail.findLast((m) => m.job === job);
const cookie = (res, name) => res.headers['set-cookie']?.find((c) => c.startsWith(`${name}=`));

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ log: () => {} });
});
afterAll(stopMemoryDb);
beforeEach(async () => {
  mail.length = 0;
  await getValkey().flushall();
});

describe('register', () => {
  it('creates a buyer, signs them in and queues a verification email', async () => {
    const res = await request(app).post('/api/auth/register').send(juana);
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ username: 'juanasantos', email: 'juana.santos@example.com', emailVerifiedAt: null, fullName: 'Juana Santos', initials: 'JS' });
    expect(res.body.data.roles).toEqual(['buyer']);
    expect(res.body.data.permissions).toContain('cart.manage');
    expect(res.body.data.user.password).toBeUndefined();
    expect(cookie(res, 'accessToken')).toMatch(/HttpOnly/);
    expect(cookie(res, 'refreshToken')).not.toMatch(/Max-Age|Expires/); // session cookie
    const sent = lastMail('verify-email');
    expect(sent.data.to).toBe('juana.santos@example.com');
    expect(sent.data.url).toMatch(/^http:\/\/localhost:5173\/verify-email\/confirm\?token=[a-f0-9]{64}$/);
  });

  it('needs the terms checkbox; stores the agreed version and audits it (Change 09)', async () => {
    const unticked = { ...juana, username: 'noterms', email: 'noterms@example.com' };
    delete unticked.acceptTerms;
    const refused = await request(app).post('/api/auth/register').send(unticked);
    expect(refused.status).toBe(400);
    expect(refused.body.errors).toEqual({ acceptTerms: 'Please agree to the Terms and Conditions to create your account.' });
    expect((await request(app).post('/api/auth/register').send({ ...unticked, acceptTerms: false })).status).toBe(400);

    const res = await request(app).post('/api/auth/register').send({ ...unticked, acceptTerms: true }).expect(201);
    expect(res.body.data.user.mustAcceptTerms).toBe(false);
    const saved = await User.findOne({ username: 'noterms' }).lean();
    expect(saved.termsVersion).toBe(1);
    expect(saved.termsAcceptedAt).toBeInstanceOf(Date);
    expect(await AuditLog.findOne({ entityId: saved._id, action: 'accept_terms' }).lean()).toMatchObject({ area: 'accounts', changes: [{ field: 'termsVersion', from: 0, to: 1 }] });
  });

  it('reports taken email and username as field errors', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...juana, email: 'kapekonek.buyer@gmail.com', username: 'buyer' });
    expect(res.status).toBe(409);
    expect(res.body.errors).toEqual({ email: 'Email is already taken', username: 'Username is already taken' });
  });

  it('validates every field', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...juana, password: 'password1', username: 'Ju', role: 'kaluppa' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['password', 'role', 'username']);
  });

  it('needs a contact number from a farmer, and saves it', async () => {
    const farmer = { ...juana, username: 'pedrofarm', email: 'pedro@example.com', role: 'farmer' };
    const missing = await request(app).post('/api/auth/register').send(farmer);
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.errors)).toEqual(['contactNumber']);
    const res = await request(app).post('/api/auth/register').send({ ...farmer, contactNumber: '0917 555 0199' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.contactNumber).toBe('09175550199');
  });

  it('refuses someone already signed in', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'kapekonek.buyer@gmail.com', password: 'KapeKonek@123' });
    expect((await agent.post('/api/auth/register').send(juana)).status).toBe(403);
  });
});

describe('login', () => {
  it('accepts a username and remembers for 30 days when asked', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'Buyer', password: 'KapeKonek@123', remember: true });
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe('buyer');
    expect(cookie(res, 'refreshToken')).toMatch(/Max-Age=2592000/);
  });

  it('gives the same message for a wrong password and an unknown account', async () => {
    const wrong = await request(app).post('/api/auth/login').send({ identifier: 'kapekonek.buyer@gmail.com', password: 'Nope123!' });
    const unknown = await request(app).post('/api/auth/login').send({ identifier: 'ghost@kapekonek.test', password: 'Nope123!' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('throttles the 6th attempt in a minute', async () => {
    const attempt = () => request(app).post('/api/auth/login').send({ identifier: 'kapekonek.buyer@gmail.com', password: 'Wrong123!' });
    for (let i = 0; i < 5; i += 1) expect((await attempt()).status).toBe(401);
    const res = await attempt();
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });
});

describe('session', () => {
  it('returns me, refreshes and logs out', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'kapekonek.farmer.unverified@gmail.com', password: 'KapeKonek@123' });

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.roles).toEqual(['farmer']);
    expect(me.body.data.permissions).toContain('dashboard.view');

    const refreshed = await agent.post('/api/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(cookie(refreshed, 'accessToken')).toBeDefined();

    expect((await agent.post('/api/auth/logout')).status).toBe(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('sets a first password once, then signs out other sessions', async () => {
    await User.create({
      firstName: 'Nora', lastName: 'Nomail', username: 'nora.nomail', password: 'Temp@1234', roles: ['farmer'],
      emailVerifiedAt: new Date(), mustChangePassword: true,
    });
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'nora.nomail', password: 'Temp@1234' });
    const other = await request(app).post('/api/auth/login').send({ identifier: 'nora.nomail', password: 'Temp@1234' });
    expect((await agent.get('/api/auth/me')).body.data.user).toMatchObject({ mustChangePassword: true, email: null });

    expect((await agent.patch('/api/auth/password/first').send({ newPassword: 'short' })).status).toBe(400);
    const res = await agent.patch('/api/auth/password/first').send({ newPassword: 'Fresh@Pass1' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(false);
    expect((await agent.get('/api/auth/me')).status).toBe(200); // this session got new cookies
    const otherRefresh = await request(app).post('/api/auth/refresh').set('Cookie', cookie(other, 'refreshToken'));
    expect(otherRefresh.status).toBe(401);

    expect((await agent.patch('/api/auth/password/first').send({ newPassword: 'Again@Pass1' })).status).toBe(409);
    expect((await request(app).post('/api/auth/login').send({ identifier: 'nora.nomail', password: 'Fresh@Pass1' })).status).toBe(200);
  });

  it('a username-only account adds its email, then verifies it before the dashboard opens (Change 08)', async () => {
    const manager = await User.findOne({ username: 'manager.santacruz' });
    await User.create({ firstName: 'Old', lastName: 'Account', username: 'old.account', password: 'Old@12345', roles: ['farmer'], emailVerifiedAt: new Date(), createdBy: manager._id });
    const agent = request.agent(app);
    const signIn = await agent.post('/api/auth/login').send({ identifier: 'old.account', password: 'Old@12345' });
    expect(signIn.body.data.user).toMatchObject({ email: null, mustVerifyEmail: true });
    expect((await agent.get('/api/farms')).body.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await agent.post('/api/auth/email/verification-notification')).status).toBe(409);

    const taken = (await User.findOne({ username: 'farmer.unverified' })).email;
    expect((await agent.post('/api/auth/email').send({ email: taken })).body.errors).toEqual({ email: 'Email is already taken' });
    mail.length = 0;
    const res = await agent.post('/api/auth/email').send({ email: 'old.account@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: 'old.account@example.com', mustVerifyEmail: true });
    expect(mail.map((m) => m.job)).toEqual(['verify-email']);
    expect((await agent.post('/api/auth/email').send({ email: 'again@example.com' })).status).toBe(409);
  });

  it('refresh without a cookie is 401', async () => {
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401);
  });
});

describe('email verification', () => {
  it('works once, then refuses the same link', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ ...juana, email: 'verify@example.com', username: 'verifyme' });
    const token = tokenOf(lastMail('verify-email').data.url);

    expect((await request(app).post('/api/auth/email/verify').send({ token })).status).toBe(200);
    expect((await User.findOne({ email: 'verify@example.com' })).emailVerifiedAt).toBeInstanceOf(Date);
    const again = await request(app).post('/api/auth/email/verify').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.message).toMatch(/expired or was already used/);
  });

  it('refuses an expired link', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ ...juana, email: 'late@example.com', username: 'lateone' });
    const token = tokenOf(lastMail('verify-email').data.url);
    await Token.updateMany({ email: 'late@example.com' }, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/api/auth/email/verify').send({ token })).status).toBe(400);
  });

  it('resends a new link (old one stops working), at most once a minute', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'kapekonek.buyer.unverified@gmail.com', password: 'KapeKonek@123' });
    expect((await agent.post('/api/auth/email/verification-notification')).status).toBe(200);
    const first = tokenOf(lastMail('verify-email').data.url);
    expect((await agent.post('/api/auth/email/verification-notification')).status).toBe(429);

    await getValkey().flushall();
    await agent.post('/api/auth/email/verification-notification');
    const second = tokenOf(lastMail('verify-email').data.url);
    expect((await request(app).post('/api/auth/email/verify').send({ token: first })).status).toBe(400);
    expect((await request(app).post('/api/auth/email/verify').send({ token: second })).status).toBe(200);
  });

  it('tells a verified user there is nothing to resend', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: 'kapekonek.buyer@gmail.com', password: 'KapeKonek@123' });
    expect((await agent.post('/api/auth/email/verification-notification')).status).toBe(409);
  });
});

describe('password reset', () => {
  it('does not reveal whether an email has an account', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(mail).toHaveLength(0);
  });

  it('resets the password, signs out old sessions and is single-use', async () => {
    await request(app).post('/api/auth/register').send({ ...juana, email: 'reset@example.com', username: 'resetme' });
    const old = request.agent(app);
    await old.post('/api/auth/login').send({ identifier: 'resetme', password: 'KapeKonek@123', remember: true });

    await request(app).post('/api/auth/forgot-password').send({ email: 'RESET@example.com' });
    const url = lastMail('reset-password').data.url;
    expect(url).toMatch(/\/reset-password\?token=[a-f0-9]{64}&email=reset%40example\.com$/);
    const token = tokenOf(url);

    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'NewPass456!' })).status).toBe(200);
    expect((await old.post('/api/auth/refresh')).status).toBe(401);
    expect((await old.get('/api/auth/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ identifier: 'resetme', password: 'NewPass456!' })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Other789!' })).status).toBe(400);
  });
});

describe('usernames', () => {
  it('suggests exactly 3 available names', async () => {
    await User.create({ firstName: 'Juana', lastName: 'Dela Cruz', username: 'juanadc', email: 'juanadc@example.com', password: 'KapeKonek@123' });
    const res = await request(app).get('/api/auth/username-suggestions').query({ firstName: 'Juana', lastName: 'Dela Cruz' });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data).not.toContain('juanadc'); // taken just above
    expect(res.body.data).toEqual(['juana.dc', 'jdelacruz', 'juana.delacruz']);
  });

  it('reports availability', async () => {
    const taken = await request(app).get('/api/auth/username-availability').query({ username: 'buyer' });
    expect(taken.body.data).toEqual({ username: 'buyer', available: false });
    const free = await request(app).get('/api/auth/username-availability').query({ username: 'brand.new' });
    expect(free.body.data.available).toBe(true);
    expect((await request(app).get('/api/auth/username-availability').query({ username: 'Bad Name' })).status).toBe(400);
  });
});
