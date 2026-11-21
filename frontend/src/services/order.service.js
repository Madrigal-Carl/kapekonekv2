import { api } from '@/api/axios'

const data = (response) => response.data.data

/** Cursor page of the buyer's orders; `status` is a list of statuses (empty = all). */
export const listOrders = ({ status, cursor, limit = 10 }) =>
  api.get('/orders', { params: { status: status?.join(',') || undefined, cursor, limit } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
/** @returns {Promise<Record<string, number>>} */
export const getOrderCounts = () => api.get('/orders/counts').then(data)
export const getOrder = (id) => api.get(`/orders/${id}`).then(data)
export const placeOrder = (body) => api.post('/orders', body).then(data)
export const cancelOrder = ({ id, reasonCode, reason }) => api.post(`/orders/${id}/cancel`, { reasonCode, reason }).then(data)
