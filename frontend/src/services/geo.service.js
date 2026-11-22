import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<{ municipality: string, barangay: string|null, street: string, postalCode: string, insideDeliveryArea: boolean }>} */
export const reverseGeocode = ({ lat, lng }) => api.get('/geo/reverse', { params: { lat, lng } }).then(data)
/** @returns {Promise<Array<{ name: string, fullAddress: string, lat: number, lng: number }>>} */
export const searchPlaces = (q) => api.get('/geo/search', { params: { q } }).then(data)
/** Where a barangay is on the map; null when Mapbox doesn't know it. @returns {Promise<{ lat: number, lng: number } | null>} */
export const findBarangay = (municipality, barangay) =>
  api.get('/geo/search', { params: { municipality, barangay } }).then((r) => data(r)[0] ?? null)
/** Quote for a point or a saved address. @returns {Promise<{ distanceKm: number, feeCentavos: number, eta: { from: string, to: string } }>} */
export const getDeliveryQuote = (params) => api.get('/delivery/quote', { params }).then(data)
