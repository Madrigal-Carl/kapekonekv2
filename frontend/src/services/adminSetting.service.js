import { api } from '@/api/axios'

const data = (r) => r.data.data

/** Kaluppa's Settings (PHASE-2-SPEC §3.13): one GET and one PATCH per section. */
export const getAdminSetting = (section) => api.get(`/admin/settings/${section}`).then(data)
export const saveAdminSetting = ({ section, body }) => api.patch(`/admin/settings/${section}`, body).then(data)
