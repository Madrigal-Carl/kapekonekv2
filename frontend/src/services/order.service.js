import { api } from '@/api/axios'
import { fetchFile } from '@/lib/download'

const data = (response) => response.data.data

/** Cursor page of the buyer's orders; `status` is a list of statuses (empty = all). */
export const listOrders = ({ status, cursor, limit = 10 }) =>
  api.get('/orders', { params: { status: status?.join(',') || undefined, cursor, limit } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
/** A numbered page of the user's own orders (farmer dashboard table): `group` is a Status group, `q` an order number or item. */
export const listOrderTable = ({ group, q, page, limit }) =>
  api.get('/orders', { params: { group: group || undefined, q: q || undefined, page, limit } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
/** @returns {Promise<Record<string, number>>} */
export const getOrderCounts = () => api.get('/orders/counts').then(data)
export const getOrder = (id) => api.get(`/orders/${id}`).then(data)
export const placeOrder = (body) => api.post('/orders', body).then(data)
export const cancelOrder = ({ id, reasonCode, reason }) => api.post(`/orders/${id}/cancel`, { reasonCode, reason }).then(data)

const adminParams = ({ status, q, type, method, payment }) => ({ status: status || undefined, q: q || undefined, type: type || undefined, method: method || undefined, payment: payment || undefined })

/** Kaluppa's Orders table: every buyer and farmer order (status group, customer type, method, payment, search). */
export const listAdminOrders = ({ page, limit, ...filters }) =>
  api.get('/admin/orders', { params: { ...adminParams(filters), page, limit } }).then((r) => ({ items: r.data.data, meta: r.data.meta }))

/** Export the table's filters as CSV or PDF. */
export const exportAdminOrders = (format, filters) => fetchFile('/admin/orders/export', { ...adminParams(filters), format })

/** Kaluppa moves an order one step (Phase 1 transitions): `{ status, reasonCode?, reason?, rider? }`. */
export const changeOrderStatus = ({ id, ...body }) => api.patch(`/orders/${id}/status`, body).then(data)
export const markOrderRefunded = ({ id, referenceNumber }) => api.patch(`/orders/${id}/refund`, { referenceNumber }).then(data)
