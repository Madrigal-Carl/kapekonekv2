import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<{ lines: Array<{ product: object, quantity: number, lineTotalCentavos: number, flags: string[] }>, count: number, subtotalCentavos: number, canCheckout: boolean }>} */
export const getCart = () => api.get('/cart').then(data)
export const addCartItem = ({ productId, quantity }) => api.post('/cart/items', { productId, quantity }).then(data)
export const setCartQuantity = ({ productId, quantity }) => api.patch(`/cart/items/${productId}`, { quantity }).then(data)
export const removeCartItem = (productId) => api.delete(`/cart/items/${productId}`).then(data)
export const clearCart = () => api.delete('/cart').then(data)
