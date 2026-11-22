import { api } from '@/api/axios'

const page = (response) => ({ items: response.data.data, meta: response.data.meta })
const data = (response) => response.data.data

/**
 * Cursor page of products. Array filters are sent comma-separated; prices in pesos.
 * @returns {Promise<{ items: object[], meta: { nextCursor: string|null, hasMore: boolean, total: number } }>}
 */
export const listProducts = ({ variety, coffeeType, ...params }) =>
  api
    .get('/products', { params: { ...params, variety: variety?.join(',') || undefined, coffeeType: coffeeType?.join(',') || undefined } })
    .then(page)

export const getProduct = (slug) => api.get(`/products/${slug}`).then(data)

export const listReviews = (productId, params) => api.get(`/products/${productId}/reviews`, { params }).then(page)
/** @returns {Promise<{ average: number, count: number, distribution: Record<1|2|3|4|5, number> }>} */
export const getReviewSummary = (productId) => api.get(`/products/${productId}/reviews/summary`).then(data)
/** @returns {Promise<{ review: object|null, canReview: boolean, reason: null|'not_purchased'|'not_completed'|'already_reviewed', pendingOrderNumber: string|null, pendingOrderId: string|null, order: { orderNumber: string, method: string, soldAt: string|null } | null }>} */
export const getMyReview = (productId) => api.get(`/products/${productId}/reviews/me`).then(data)
export const createReview = ({ productId, ...body }) => api.post(`/products/${productId}/reviews`, body).then(data)
export const updateReview = ({ reviewId, ...body }) => api.patch(`/reviews/${reviewId}`, body).then(data)
export const deleteReview = (reviewId) => api.delete(`/reviews/${reviewId}`).then(data)
