import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<object>} the public user */
export const getProfile = () => api.get('/account/profile').then(data)
export const updateProfile = (body) => api.patch('/account/profile', body).then(data)
/** @param {{ url: string, publicId: string }} avatar */
export const setAvatar = (avatar) => api.patch('/account/avatar', avatar).then(data)
export const removeAvatar = () => api.delete('/account/avatar').then(data)
/** @returns {Promise<{ user: object, roles: string[], permissions: string[] }>} the new session (email unverified) */
export const changeEmail = (body) => api.patch('/account/email', body).then(data)
/** @returns {Promise<{ user: object, roles: string[], permissions: string[] }>} */
export const changePassword = (body) => api.patch('/account/password', body).then(data)
