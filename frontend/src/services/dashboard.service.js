import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<Record<string, number>>} sidebar badge counts, only keys the user may act on */
export const getBadges = () => api.get('/dashboard/badges').then(data)
/** @returns {Promise<object|null>} the sidebar association card (null for Kaluppa) */
export const getOrgCard = () => api.get('/dashboard/org').then(data)
/** @returns {Promise<{ view: 'farmer'|'group_manager'|'kaluppa' }>} the role's overview data */
export const getOverview = () => api.get('/dashboard/overview').then(data)
