import { api } from '@/api/axios'

/** The current Terms and Conditions and Privacy Policy: { version, updatedAt, terms: [{ heading, paragraphs }], privacy }. */
export const getCurrentLegal = () => api.get('/legal/current').then((r) => r.data.data)
/** Agree to `version`; returns the fresh session. */
export const acceptTerms = (version) => api.post('/legal/accept', { version }).then((r) => r.data.data)
