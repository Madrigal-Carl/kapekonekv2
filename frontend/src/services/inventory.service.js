import { api } from '@/api/axios'

const data = (r) => r.data.data
const blank = (v) => v || undefined

/** Kaluppa's Inventory table: Status, category, stock state, name search; numbered pages. */
export const listInventory = ({ status, category, stock, q, page, limit }) =>
  api
    .get('/admin/products', { params: { status: blank(status), category: blank(category), stock: blank(stock), q: blank(q), page, limit } })
    .then((r) => ({ items: r.data.data, meta: r.data.meta }))
export const getInventoryProduct = (id) => api.get(`/admin/products/${id}`).then(data)
export const createProduct = (body) => api.post('/admin/products', body).then(data)
export const updateProduct = ({ id, ...body }) => api.patch(`/admin/products/${id}`, body).then(data)
export const archiveProduct = (id) => api.post(`/admin/products/${id}/archive`).then(data)
export const restoreProduct = (id) => api.post(`/admin/products/${id}/restore`).then(data)
