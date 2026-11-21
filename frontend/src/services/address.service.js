import { api } from '@/api/axios'

const data = (response) => response.data.data

/** Saved addresses, each with `quote` ({ distanceKm, feeCentavos, eta }) or `quoteError`. */
export const listAddresses = () => api.get('/addresses').then(data)
export const createAddress = (body) => api.post('/addresses', body).then(data)
export const updateAddress = ({ id, ...body }) => api.patch(`/addresses/${id}`, body).then(data)
export const deleteAddress = (id) => api.delete(`/addresses/${id}`).then(data)
export const setDefaultAddress = (id) => api.post(`/addresses/${id}/default`).then(data)
