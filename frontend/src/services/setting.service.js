import { api } from '@/api/axios'

/** @returns {Promise<{ heroSlides: Array<{ title: string, subtitle: string, image: { url: string, alt: string } | null, ctaLabel: string, ctaHref: string }> }>} */
export const getLanding = () => api.get('/settings/landing').then((r) => r.data.data)

/** @returns {Promise<{ pickup: { name: string, address: string, hours: string, location: { lat: number, lng: number } }, fee: object, eta: { minBusinessDays: number, maxBusinessDays: number } }>} */
export const getDeliveryInfo = () => api.get('/delivery/info').then((r) => r.data.data)
/** @returns {Promise<Array<{ name: string, postalCode: string, barangays: string[] }>>} */
export const getLocations = () => api.get('/locations').then((r) => r.data.data)
/** @returns {Promise<{ providers: string[], accountName: string, accountNumber: string, qrImageUrl: string|null, qrPayload: string, isSample: boolean }>} */
export const getPaymentSettings = () => api.get('/settings/payment').then((r) => r.data.data)
