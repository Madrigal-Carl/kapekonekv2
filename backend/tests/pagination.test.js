import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cursorFilter, cursorSort, decodeCursor, encodeCursor, pageResult } from '../src/utils/pagination.js';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const Item = mongoose.model('PaginationItem', new mongoose.Schema({ price: Number, at: Date }));

beforeAll(async () => {
  await startMemoryDb();
  // 25 items over only 3 prices and 2 dates, so most sort values tie.
  await Item.insertMany(Array.from({ length: 25 }, (_, i) => ({ price: [100, 200, 300][i % 3], at: new Date(Date.UTC(2026, 0, 1 + (i % 2))) })));
});
afterAll(stopMemoryDb);

async function pageThrough(sortField, direction, limit) {
  const seen = [];
  let cursor;
  do {
    const docs = await Item.find(cursorFilter({ sortField, direction, cursor })).sort(cursorSort({ sortField, direction })).limit(limit + 1).lean();
    const { items, meta } = pageResult(docs, limit, sortField);
    seen.push(...items);
    cursor = meta.nextCursor;
    expect(meta.hasMore).toBe(Boolean(cursor));
  } while (cursor);
  return seen;
}

describe('cursor pagination', () => {
  for (const direction of ['asc', 'desc']) {
    it(`returns every item exactly once on a tied ${direction} sort`, async () => {
      const seen = await pageThrough('price', direction, 7);
      const ids = seen.map((d) => String(d._id));
      expect(ids).toHaveLength(25);
      expect(new Set(ids).size).toBe(25);
      const prices = seen.map((d) => d.price);
      expect(prices).toEqual([...prices].sort((a, b) => (direction === 'asc' ? a - b : b - a)));
    });
  }

  it('round-trips Date sort values', async () => {
    const ids = (await pageThrough('at', 'desc', 4)).map((d) => String(d._id));
    expect(new Set(ids).size).toBe(25);
  });

  it('pages by _id alone', async () => {
    expect(await pageThrough('_id', 'desc', 10)).toHaveLength(25);
  });

  it('rejects a tampered cursor with a field error', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(expect.objectContaining({ statusCode: 400, errors: { cursor: 'Invalid cursor' } }));
    const badId = Buffer.from(JSON.stringify([1, 'xyz'])).toString('base64url');
    expect(() => decodeCursor(badId)).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('encodes and decodes', () => {
    const id = new mongoose.Types.ObjectId();
    const at = new Date('2026-11-21T00:00:00Z');
    const decoded = decodeCursor(encodeCursor(at, id));
    expect(decoded.value).toEqual(at);
    expect(String(decoded.id)).toBe(String(id));
  });
});
