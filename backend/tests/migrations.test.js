import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

vi.mock('../src/config/valkey.js', () => ({ getValkey: () => null, closeValkeyConnections: async () => {} }));

const { migrate } = await import('../src/database/commands/migrate.js');

beforeAll(startMemoryDb);
afterAll(stopMemoryDb);

describe('npm run migrate', () => {
  it('Change 08 drops the farm lot number and its unique index, once', async () => {
    const farms = mongoose.connection.db.collection('farms');
    await farms.createIndex({ owner: 1, lotNumber: 1 }, { unique: true, name: 'owner_1_lotNumber_1' });
    await farms.insertOne({ propertyNumber: 'TCT-2026-0001', lotNumber: 'Lot 12-B', sizeHa: 1.2 });

    expect(await migrate()).toEqual(['2026-11-28-drop-farm-lot-number']);
    expect(await farms.findOne({}, { projection: { _id: 0 } })).toEqual({ propertyNumber: 'TCT-2026-0001', sizeHa: 1.2 });
    expect((await farms.indexes()).some((i) => i.key.lotNumber)).toBe(false);
    expect(await migrate()).toEqual([]); // recorded: never runs twice
  });
});
