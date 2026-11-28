import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const { pageList } = await import('../src/utils/pageList.js');
const { pageQuerySchema } = await import('../src/schemas/common.schema.js');
const { Counter } = await import('../src/models/index.js');

beforeAll(async () => {
  await startMemoryDb();
  await Counter.insertMany(Array.from({ length: 23 }, (_, i) => ({ _id: `c${String(i).padStart(2, '0')}`, seq: i })));
});
afterAll(stopMemoryDb);

describe('pageList', () => {
  it('returns one numbered page and the total', async () => {
    const { items, meta } = await pageList(Counter.find({ seq: { $gte: 0 } }).sort({ seq: 1 }), { page: 2, limit: 10 });
    expect(meta).toEqual({ page: 2, limit: 10, total: 23 });
    expect(items.map((c) => c.seq)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect((await pageList(Counter.find().sort({ seq: 1 }), { page: 3, limit: 10 })).items).toHaveLength(3);
  });

  it('reads ?page and ?limit with the dashboard defaults (10, up to 50)', () => {
    expect(pageQuerySchema.parse({})).toMatchObject({ page: 1, limit: 10 });
    expect(pageQuerySchema.parse({ page: '3', limit: '50' })).toMatchObject({ page: 3, limit: 50 });
    expect(pageQuerySchema.safeParse({ limit: '51' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
