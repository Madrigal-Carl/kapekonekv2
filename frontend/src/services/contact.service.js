import { api } from '@/api/axios'

/** Contact us (Change 08). Anyone may send; Kaluppa reads them in the dashboard. */
export const sendContactMessage = (body) => api.post('/contact', body).then((r) => r.data.data)
export const listContactMessages = (params) => api.get('/admin/contact-messages', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }))
export const getContactMessage = (id) => api.get(`/admin/contact-messages/${id}`).then((r) => r.data.data)
