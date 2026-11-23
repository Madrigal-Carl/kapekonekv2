import { api } from '@/api/axios'

const data = (response) => response.data.data
const page = (response) => ({ items: response.data.data, meta: response.data.meta })

// Farms, tree groups and harvests (PHASE-2-SPEC §3.6). The API scopes every list to what the user may see.
export const listFarms = (params) => api.get('/farms', { params }).then(page)
export const getFarm = (id) => api.get(`/farms/${id}`).then(data)
export const createFarm = (body) => api.post('/farms', body).then(data)
export const updateFarm = ({ id, ...body }) => api.patch(`/farms/${id}`, body).then(data)
export const archiveFarm = (id) => api.post(`/farms/${id}/archive`).then(data)
export const restoreFarm = (id) => api.post(`/farms/${id}/restore`).then(data)
export const setAssignedFarmers = ({ id, farmerIds }) => api.put(`/farms/${id}/assigned-farmers`, { farmerIds }).then(data)

export const listTreeGroups = (params) => api.get('/tree-groups', { params }).then(page)
export const createTreeGroup = (body) => api.post('/tree-groups', body).then(data)
export const updateTreeGroup = ({ id, ...body }) => api.patch(`/tree-groups/${id}`, body).then(data)
export const archiveTreeGroup = (id) => api.post(`/tree-groups/${id}/archive`).then(data)
export const restoreTreeGroup = (id) => api.post(`/tree-groups/${id}/restore`).then(data)

export const listHarvests = (params) => api.get('/harvests', { params }).then(page)
export const createHarvest = (body) => api.post('/harvests', body).then(data)
export const updateHarvest = ({ id, ...body }) => api.patch(`/harvests/${id}`, body).then(data)
export const archiveHarvest = (id) => api.post(`/harvests/${id}/archive`).then(data)
export const restoreHarvest = (id) => api.post(`/harvests/${id}/restore`).then(data)
