import { api } from '@/api/axios'

const data = (r) => r.data.data
const blank = (v) => v || undefined

/** Kaluppa's Reviews table: Status, product, stars, reply state, search; numbered pages. */
export const listAdminReviews = ({ status, product, rating, reply, q, page, limit }) =>
  api
    .get('/admin/reviews', { params: { status: blank(status), product: blank(product), rating: blank(rating), reply: blank(reply), q: blank(q), page, limit } })
    .then((r) => ({ items: r.data.data, meta: r.data.meta }))
export const listReviewedProducts = () => api.get('/admin/reviews/products').then(data)
export const getAdminReview = (id) => api.get(`/admin/reviews/${id}`).then(data)
export const saveReply = ({ id, body }) => api.put(`/admin/reviews/${id}/reply`, { body }).then(data)
export const deleteReply = (id) => api.delete(`/admin/reviews/${id}/reply`).then(data)
export const hideReview = ({ id, reason }) => api.post(`/admin/reviews/${id}/hide`, { reason }).then(data)
export const unhideReview = (id) => api.post(`/admin/reviews/${id}/unhide`).then(data)
