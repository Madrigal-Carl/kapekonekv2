import { api } from '@/api/axios'

// The address book version this tab last saw (Change 08). Every change sends it as If-Match;
// the server answers 409 ADDRESSES_CHANGED when another tab changed the book first.
let version
const track = (response) => {
  if (response.data.meta?.version !== undefined) version = response.data.meta.version
  return response.data.data
}
const ifMatch = () => (version === undefined ? undefined : { headers: { 'If-Match': String(version) } })

/** Saved addresses, each with `quote` ({ distanceKm, feeCentavos, eta }) or `quoteError`. */
export const listAddresses = () => api.get('/addresses').then(track)
export const createAddress = (body) => api.post('/addresses', body, ifMatch()).then(track)
export const updateAddress = ({ id, ...body }) => api.patch(`/addresses/${id}`, body, ifMatch()).then(track)
export const deleteAddress = (id) => api.delete(`/addresses/${id}`, ifMatch()).then(track)
export const setDefaultAddress = (id) => api.post(`/addresses/${id}/default`, undefined, ifMatch()).then(track)
