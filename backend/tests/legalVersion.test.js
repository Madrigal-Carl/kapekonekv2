import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';
import { signedIn } from './helpers/farmers.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});
vi.mock('../src/queues/email.queue.js', () => ({ enqueueEmail: vi.fn(async () => {}) }));

const { default: app } = await import('../src/app.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User } = await import('../src/models/index.js');
const legal = await import('../src/constants/legal.js');

// Change 09B: raising TERMS_VERSION asks every user again at their next sign-in. Seed at v1, then "release" v2.
beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  vi.spyOn(legal, 'mustAcceptTerms').mockImplementation((user) => (user.termsVersion ?? 0) < 2);
});
afterAll(stopMemoryDb);

describe('raising TERMS_VERSION', () => {
  it('asks every role again', async () => {
    for (const handle of ['buyer', 'farmer.approved', 'manager.santacruz', 'kaluppa']) {
      const agent = await signedIn(app, handle);
      expect((await agent.get('/api/auth/me')).body.data.user.mustAcceptTerms, handle).toBe(true);
      expect((await agent.get('/api/notifications?limit=5')).body.code, handle).toBe('TERMS_REQUIRED');
    }
    expect(await User.countDocuments({ termsVersion: 1 })).toBe(await User.countDocuments());
  });
});
