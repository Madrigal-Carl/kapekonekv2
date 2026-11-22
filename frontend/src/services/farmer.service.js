import { api } from '@/api/axios'

const data = (response) => response.data.data
const page = (response) => ({ items: response.data.data, meta: response.data.meta })

// The farmer's own association state (PHASE-2-SPEC §3.1).
export const getMyFarmerProfile = () => api.get('/me/farmer-profile').then(data)
/** @param {{ associationId: string, validId: { url: string, publicId: string }, landProof: { url: string, publicId: string } }} body */
export const requestToJoin = (body) => api.post('/me/farmer-profile/request', body).then(data)
export const requestTransfer = (body) => api.post('/me/farmer-profile/transfer', body).then(data)
export const withdrawTransfer = () => api.delete('/me/farmer-profile/transfer').then(data)

// Group Managers (and Kaluppa) manage farmers.
export const listFarmers = (params) => api.get('/farmers', { params }).then(page)
export const getFarmer = (id) => api.get(`/farmers/${id}`).then(data)
/** @returns {Promise<{ farmer: object, temporaryPassword?: string }>} */
export const createFarmer = (body) => api.post('/farmers', body).then(data)
export const updateFarmer = ({ id, ...body }) => api.patch(`/farmers/${id}`, body).then(data)
export const approveFarmer = (id) => api.post(`/farmers/${id}/approve`).then(data)
export const rejectFarmer = ({ id, reason }) => api.post(`/farmers/${id}/reject`, { reason }).then(data)
export const approveTransfer = (id) => api.post(`/farmers/${id}/transfer/approve`).then(data)
export const rejectTransfer = ({ id, reason }) => api.post(`/farmers/${id}/transfer/reject`, { reason }).then(data)
export const removeFarmer = ({ id, reason }) => api.post(`/farmers/${id}/remove`, { reason }).then(data)
