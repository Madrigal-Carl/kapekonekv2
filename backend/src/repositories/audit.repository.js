import { AuditLog } from '../models/auditLog.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

/** @param {object} entry an AuditLog document */
export const insertAuditEntry = (entry) => AuditLog.create(entry);

/**
 * One record's history, newest first, cursor-paged on `at`.
 * @param {{ entityType: string, entityId: unknown, cursor?: string, limit: number }} query
 */
export async function listEntityHistory({ entityType, entityId, cursor, limit }) {
  const order = { sortField: 'at', direction: 'desc', cursor };
  const docs = await AuditLog.find({ entityType, entityId, ...cursorFilter(order) })
    .sort(cursorSort(order))
    .limit(limit + 1)
    .populate('actor', 'firstName lastName avatar')
    .lean();
  return pageResult(docs, limit, 'at');
}
