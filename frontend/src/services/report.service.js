import { api } from '@/api/axios'
import { fetchFile } from '@/lib/download'

/** One Reports section (PHASE-2-SPEC §3.12): summary | harvest | beans | sales | trees | breakdown. */
export const getReport = (section, params) => api.get(`/reports/${section}`, { params }).then((r) => r.data.data)

/** Export the whole report (`scope: 'all'`) or the breakdown table (`'table'`) as CSV or PDF, for the filters on screen. */
export const exportReport = (format, scope, params) => fetchFile('/reports/export', { ...params, format, scope })
