import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis };
});

const { runSeeders } = await import('../src/database/seeders/index.js');
const { assertCanDropDatabase } = await import('../src/database/commands/migrateFresh.js');
const { User, Role, Permission } = await import('../src/models/index.js');

beforeAll(startMemoryDb);
afterAll(stopMemoryDb);

const counts = async () => ({ roles: await Role.countDocuments(), permissions: await Permission.countDocuments(), users: await User.countDocuments() });

describe('runSeeders', () => {
  it('is idempotent and creates the demo accounts', async () => {
    const log = () => {};
    await runSeeders({ log });
    const first = await counts();
    await runSeeders({ log });
    expect(await counts()).toEqual(first);
    expect(first).toEqual({ roles: 4, permissions: 17, users: 26 });

    const byEmail = async (local) => User.findOne({ email: `${local}@kapekonek.test` }).select('+password');
    expect((await byEmail('kaluppa')).roles).toEqual(['kaluppa']);
    expect((await byEmail('manager')).roles).toEqual(['group_manager']);
    expect((await byEmail('farmer1')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('farmer2')).emailVerifiedAt).toBeNull();
    expect((await byEmail('buyer')).emailVerifiedAt).not.toBeNull();
    expect((await byEmail('buyer.unverified')).emailVerifiedAt).toBeNull();
    expect(await (await byEmail('buyer')).comparePassword('Password123!')).toBe(true);
  });

  it('refuses unknown seeder names', async () => {
    await expect(runSeeders({ only: ['nope'], log: () => {} })).rejects.toThrow(/Unknown seeder: nope/);
  });
});

describe('migrate:fresh guard', () => {
  it('refuses production without --force', () => {
    expect(() => assertCanDropDatabase('production', ['--seed'])).toThrow(/Refusing/);
    expect(() => assertCanDropDatabase('production', ['--force'])).not.toThrow();
    expect(() => assertCanDropDatabase('development', [])).not.toThrow();
  });
});
