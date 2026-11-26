import { api } from '@/api/axios'

/**
 * A record's history for its drawer, newest first (PHASE-2-SPEC §3.15).
 * @param {string} entityType e.g. 'farm', 'order' @param {string} entityId @param {string} [cursor]
 * @returns {Promise<{ items: object[], meta: { nextCursor: string|null, hasMore: boolean, canOpenAuditLog: boolean } }>}
 */
export const getEntityHistory = (entityType, entityId, cursor) =>
  api.get(`/audit-logs/entity/${entityType}/${entityId}`, { params: { cursor } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
