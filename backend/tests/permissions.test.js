import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { getValkey } = await import('../src/config/valkey.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User, Role } = await import('../src/models/index.js');
const { authenticate } = await import('../src/middlewares/auth.middleware.js');
const { verified } = await import('../src/middlewares/verified.middleware.js');
const { can, canAny } = await import('../src/middlewares/permission.middleware.js');
const { errorHandler } = await import('../src/middlewares/error.middleware.js');
const { clearPermissionCache, resolvePermissions } = await import('../src/services/permission.service.js');
const { signAccessToken } = await import('../src/utils/tokens.js');

const app = express().use(cookieParser());
const ok = (_req, res) => res.json({ ok: true });
app.get('/manage', authenticate, can('orders.manage'), ok);
app.get('/anything', authenticate, can('anything.at_all'), ok);
app.get('/cart', authenticate, verified, can('cart.manage'), ok);
app.get('/any', authenticate, canAny('orders.manage', 'dashboard.view'), ok);
app.get('/dashboard', authenticate, verified, ok);
app.use(errorHandler);

const user = (local) => User.findOne({ email: `kapekonek.${local}@gmail.com` });
const as = (u) => `accessToken=${signAccessToken(u)}`;

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ log: () => {} });
});
afterAll(stopMemoryDb);
beforeEach(() => getValkey().flushall());

describe('permission guards', () => {
  it('lets kaluppa pass any permission', async () => {
    const res = await request(app).get('/anything').set('Cookie', as(await user('kaluppa')));
    expect(res.status).toBe(200);
  });

  it('forbids a buyer from managing orders', async () => {
    const res = await request(app).get('/manage').set('Cookie', as(await user('buyer')));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('allows a verified buyer to manage their cart', async () => {
    expect((await request(app).get('/cart').set('Cookie', as(await user('buyer')))).status).toBe(200);
  });

  it('canAny passes with one of the permissions', async () => {
    expect((await request(app).get('/any').set('Cookie', as(await user('farmer.approved')))).status).toBe(200);
    expect((await request(app).get('/any').set('Cookie', as(await user('buyer')))).status).toBe(403);
  });

  it('rejects requests without a session', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('verified', () => {
  it('blocks an unverified buyer with EMAIL_NOT_VERIFIED', async () => {
    const res = await request(app).get('/cart').set('Cookie', as(await user('buyer.unverified')));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('lets an unverified farmer through', async () => {
    expect((await request(app).get('/dashboard').set('Cookie', as(await user('farmer.unverified')))).status).toBe(200);
  });
});

describe('authenticate', () => {
  it('refuses a suspended user', async () => {
    const u = await User.create({ firstName: 'S', lastName: 'U', username: 'suspended', email: 's@kapekonek.test', password: 'KapeKonek@123', roles: ['buyer'], emailVerifiedAt: new Date(), status: 'suspended' });
    const res = await request(app).get('/cart').set('Cookie', as(u));
    expect(res.status).toBe(403);
  });

  it('refuses an access token issued before a password change', async () => {
    const u = await user('buyer');
    const cookie = as(u);
    await User.updateOne({ _id: u._id }, { $inc: { tokenVersion: 1 } });
    const res = await request(app).get('/cart').set('Cookie', cookie);
    expect(res.status).toBe(401);
    await User.updateOne({ _id: u._id }, { $inc: { tokenVersion: -1 } });
  });
});

describe('permission cache', () => {
  it('serves from cache until cleared', async () => {
    const u = await user('farmer.approved');
    expect(await resolvePermissions(u)).not.toContain('orders.manage');
    expect(await getValkey().ttl(`perm:user:${u._id}`)).toBeGreaterThan(590);

    await Role.updateOne({ slug: 'farmer' }, { $push: { permissions: 'orders.manage' } });
    expect(await resolvePermissions(u)).not.toContain('orders.manage'); // cached

    await clearPermissionCache(u._id);
    expect(await resolvePermissions(u)).toContain('orders.manage');
    await Role.updateOne({ slug: 'farmer' }, { $pull: { permissions: 'orders.manage' } });
  });

  it('is cleared for every user when the roles seeder runs', async () => {
    const u = await user('buyer');
    await resolvePermissions(u);
    expect(await getValkey().exists(`perm:user:${u._id}`)).toBe(1);
    await runSeeders({ only: ['roles'], log: () => {} });
    expect(await getValkey().exists(`perm:user:${u._id}`)).toBe(0);
  });

  it('falls back to Mongo when Valkey is down', async () => {
    const valkey = getValkey();
    const get = valkey.get;
    valkey.get = () => Promise.reject(new Error('ECONNREFUSED'));
    try {
      expect(await resolvePermissions(await user('buyer'))).toContain('cart.manage');
    } finally {
      valkey.get = get;
    }
  });
});
