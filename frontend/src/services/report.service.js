import { api } from '@/api/axios'

/** One Reports section (PHASE-2-SPEC §3.12): summary | harvest | beans | sales | trees | breakdown. */
export const getReport = (section, params) => api.get(`/reports/${section}`, { params }).then((r) => r.data.data)

/** The CSV download link for a section or `all` (the cookie session goes with the navigation). */
export const reportCsvUrl = (section, params) => api.getUri({ url: '/reports/export.csv', params: { ...params, section } })
