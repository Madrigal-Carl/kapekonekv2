import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<{ user: object, roles: string[], permissions: string[] }>} */
export const getMe = () => api.get('/auth/me').then(data)
export const login = (body) => api.post('/auth/login', body).then(data)
export const register = (body) => api.post('/auth/register', body).then(data)
export const logout = () => api.post('/auth/logout')
export const verifyEmail = (token) => api.post('/auth/email/verify', { token })
export const resendVerification = () => api.post('/auth/email/verification-notification')
/** A username-only account adds its first email; returns the new session. */
export const addEmail = (body) => api.post('/auth/email', body).then(data)
export const forgotPassword = (body) => api.post('/auth/forgot-password', body)
export const resetPassword = (body) => api.post('/auth/reset-password', body)
export const setFirstPassword = (body) => api.patch('/auth/password/first', body).then(data)
/** @returns {Promise<{ username: string, available: boolean }>} */
export const usernameAvailability = (username) => api.get('/auth/username-availability', { params: { username } }).then(data)
/** @returns {Promise<string[]>} */
export const usernameSuggestions = (params) => api.get('/auth/username-suggestions', { params }).then(data)
