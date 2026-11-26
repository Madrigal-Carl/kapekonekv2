import { AuditLog } from '../models/auditLog.model.js';
import { pageList } from '../utils/pageList.js';
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

const ACTOR = ['actor', 'firstName lastName avatar'];

/**
 * The audit log's filter (PHASE-2-SPEC §3.12): area, actor role, a time window, one record, and a search over the
 * record label, the action, the area or the actor (`actorIds`, people whose name matched).
 * @param {{ area?: string, role?: string, from?: Date, to?: Date, entity?: string, q?: RegExp, actorIds?: unknown[] }} f
 */
const auditFilter = ({ area, role, from, to, entity, q, actorIds = [] }) => ({
  ...(area && { area }),
  ...(role && { actorRole: role }),
  ...((from || to) && { at: { ...(from && { $gte: from }), ...(to && { $lt: to }) } }),
  ...(entity && { entityId: entity }),
  ...(q && { $or: [{ entityLabel: q }, { action: q }, { area: q }, { actor: { $in: actorIds } }] }),
});
const NEWEST = { at: -1, _id: -1 };

/** One numbered page of audit entries, newest first. */
export const listAuditPage = (filters, paging) => pageList(AuditLog.find(auditFilter(filters)).sort(NEWEST).populate(...ACTOR), paging);

/** Every matching entry for the CSV, newest first, capped. */
export const listAuditForExport = (filters, max) => AuditLog.find(auditFilter(filters)).sort(NEWEST).limit(max).populate(...ACTOR).lean();

export const findAuditEntryById = (id) => AuditLog.findById(id).populate(...ACTOR).lean();
