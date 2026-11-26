import { api } from '@/api/axios'

/**
 * A record's history for its drawer, newest first (PHASE-2-SPEC §3.15).
 * @param {string} entityType e.g. 'farm', 'order' @param {string} entityId @param {string} [cursor]
 * @returns {Promise<{ items: object[], meta: { nextCursor: string|null, hasMore: boolean, canOpenAuditLog: boolean } }>}
 */
export const getEntityHistory = (entityType, entityId, cursor) =>
  api.get(`/audit-logs/entity/${entityType}/${entityId}`, { params: { cursor } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))

const page = (r) => ({ items: r.data.data, meta: r.data.meta })

/** The audit log (Kaluppa): `?area&role&from&to&entity&q&page&limit` → `{ items, meta: { page, limit, total } }`. */
export const listAuditLog = (params) => api.get('/audit-logs', { params }).then(page)
export const getAuditEntry = (id) => api.get(`/audit-logs/${id}`).then((r) => r.data.data)
/** The CSV download link for the same filters (the cookie session goes with the navigation). */
export const auditCsvUrl = (params) => api.getUri({ url: '/audit-logs/export.csv', params })
