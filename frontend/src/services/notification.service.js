import { api } from '@/api/axios'

const data = (response) => response.data.data

/** Cursor page of the user's notifications, newest first. */
export const listNotifications = ({ cursor, limit = 8 }) =>
  api.get('/notifications', { params: { cursor, limit } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
/** @returns {Promise<{ count: number }>} */
export const getUnreadCount = () => api.get('/notifications/unread-count').then(data)
export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`).then(data)
export const markAllNotificationsRead = () => api.patch('/notifications/read-all').then(data)
