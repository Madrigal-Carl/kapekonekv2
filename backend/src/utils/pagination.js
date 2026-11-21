import mongoose from 'mongoose';
import { AppError } from './AppError.js';

const invalid = () => new AppError(400, 'Invalid cursor', { errors: { cursor: 'Invalid cursor' } });

/**
 * Encode a `(sortValue, _id)` pair as an opaque cursor.
 * @param {unknown} value
 * @param {unknown} id
 */
export const encodeCursor = (value, id) =>
  Buffer.from(JSON.stringify([value instanceof Date ? { $date: value.toISOString() } : value, String(id)])).toString('base64url');

/**
 * @param {string} cursor
 * @returns {{ value: unknown, id: mongoose.Types.ObjectId }}
 */
export function decodeCursor(cursor) {
  let value;
  let id;
  try {
    [value, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (!mongoose.isObjectIdOrHexString(id)) throw invalid();
  if (value && typeof value === 'object' && '$date' in value) value = new Date(value.$date);
  return { value, id: new mongoose.Types.ObjectId(id) };
}

/** Mongo sort with `_id` as the tie-breaker so non-unique sorts stay stable. */
export const cursorSort = ({ sortField, direction }) => {
  const dir = direction === 'asc' ? 1 : -1;
  return sortField === '_id' ? { _id: dir } : { [sortField]: dir, _id: dir };
};

/** Filter selecting the documents after `cursor` in `cursorSort` order. */
export function cursorFilter({ sortField, direction, cursor }) {
  if (!cursor) return {};
  const { value, id } = decodeCursor(cursor);
  const op = direction === 'asc' ? '$gt' : '$lt';
  if (sortField === '_id') return { _id: { [op]: id } };
  return { $or: [{ [sortField]: { [op]: value } }, { [sortField]: value, _id: { [op]: id } }] };
}

/**
 * Trim a `limit + 1` query result into a page.
 * @template T
 * @param {T[]} docs fetched with `.limit(limit + 1)`
 * @param {number} limit
 * @param {string} sortField
 * @returns {{ items: T[], meta: { nextCursor: string | null, hasMore: boolean } }}
 */
export function pageResult(docs, limit, sortField) {
  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items.at(-1);
  return { items, meta: { nextCursor: hasMore ? encodeCursor(last[sortField], last._id) : null, hasMore } };
}
