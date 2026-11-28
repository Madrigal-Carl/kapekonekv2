import { api } from '@/api/axios'

const data = (response) => response.data.data
const page = (response) => ({ items: response.data.data, meta: response.data.meta })

/** Active associations for pickers: `[{ id, name, municipality, groupManager: { name } | null }]`. */
export const listAssociationOptions = () => api.get('/associations/options').then(data)

export const listAssociations = (params) => api.get('/associations', { params }).then(page)
export const getAssociation = (id) => api.get(`/associations/${id}`).then(data)
export const createAssociation = (body) => api.post('/associations', body).then(data)
export const updateAssociation = ({ id, ...body }) => api.patch(`/associations/${id}`, body).then(data)
export const archiveAssociation = (id) => api.post(`/associations/${id}/archive`).then(data)
export const restoreAssociation = (id) => api.post(`/associations/${id}/restore`).then(data)

export const listGroupManagers = (params) => api.get('/group-managers', { params }).then(page)
export const getGroupManager = (id) => api.get(`/group-managers/${id}`).then(data)
export const createGroupManager = (body) => api.post('/group-managers', body).then(data)
export const updateGroupManager = ({ id, ...body }) => api.patch(`/group-managers/${id}`, body).then(data)
export const archiveGroupManager = (id) => api.post(`/group-managers/${id}/archive`).then(data)
export const restoreGroupManager = (id) => api.post(`/group-managers/${id}/restore`).then(data)
export const resetGroupManagerPassword = (id) => api.post(`/group-managers/${id}/reset-password`).then(data)
