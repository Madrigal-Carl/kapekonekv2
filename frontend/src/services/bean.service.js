import { api } from '@/api/axios'

const data = (response) => response.data.data
const page = (response) => ({ items: response.data.data, meta: response.data.meta })

// Bean sales to Kaluppa (PHASE-2-SPEC §3.5). The API scopes every list to what the user may see.
export const listBeans = (params) => api.get('/beans', { params }).then(page)
export const getBean = (id) => api.get(`/beans/${id}`).then(data)
export const getBeanCap = (params) => api.get('/beans/cap', { params }).then(data)
export const createBean = (body) => api.post('/beans', body).then(data)
export const updateBean = ({ id, ...body }) => api.patch(`/beans/${id}`, body).then(data)
export const approveBean = (id) => api.post(`/beans/${id}/approve`).then(data)
export const rejectBean = ({ id, reason }) => api.post(`/beans/${id}/reject`, { reason }).then(data)
export const completeBean = ({ id, ...body }) => api.post(`/beans/${id}/complete`, body).then(data)
export const cancelBean = ({ id, reason }) => api.post(`/beans/${id}/cancel`, reason ? { reason } : {}).then(data)
