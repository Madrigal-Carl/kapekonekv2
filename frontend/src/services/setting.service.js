import { api } from '@/api/axios'

/** @returns {Promise<{ heroSlides: Array<{ title: string, subtitle: string, image: { url: string, alt: string } | null, ctaLabel: string, ctaHref: string }> }>} */
export const getLanding = () => api.get('/settings/landing').then((r) => r.data.data)
