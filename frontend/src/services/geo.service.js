import { api } from '@/api/axios'

const data = (response) => response.data.data

/** @returns {Promise<{ municipality: string, barangay: string|null, street: string, postalCode: string, insideDeliveryArea: boolean }>} */
export const reverseGeocode = ({ lat, lng }) => api.get('/geo/reverse', { params: { lat, lng } }).then(data)
/** @returns {Promise<Array<{ name: string, fullAddress: string, lat: number, lng: number }>>} */
export const searchPlaces = (q) => api.get('/geo/search', { params: { q } }).then(data)
/**
 * PSGC polygons: all municipalities, or one municipality's barangays. Feature properties:
 * `{ psgc, municipality, barangay, label: [lng, lat], bbox: [w, s, e, n] }`.
 * @param {'municipality'|'barangay'} level
 */
export const getBoundaries = (level, municipality) => api.get('/locations/boundaries', { params: { level, municipality } }).then(data)
/** Quote for a point or a saved address. @returns {Promise<{ distanceKm: number, feeCentavos: number, eta: { from: string, to: string } }>} */
export const getDeliveryQuote = (params) => api.get('/delivery/quote', { params }).then(data)
