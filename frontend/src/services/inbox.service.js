import { api } from '@/api/axios'

const data = (response) => response.data.data
const page = (response) => ({ items: response.data.data, meta: response.data.meta })

// The Inbox (PHASE-2-SPEC §3.9, §5). The API only returns chats the user is a member of.
export const listConversations = (params) => api.get('/conversations', { params }).then(data)
export const getConversation = (id) => api.get(`/conversations/${id}`).then(data)
/** `userId` is a person's id, or `'kaluppa'` for the Kaluppa team. */
export const openDirect = (userId) => api.post('/conversations/direct', { userId }).then(data)
export const listPeople = (q) => api.get('/inbox/people', { params: { q: q || undefined } }).then(data)
/** Newest first; `before` is the previous page's `nextCursor`. */
export const listMessages = (id, before) => api.get(`/conversations/${id}/messages`, { params: { before } }).then(page)
export const sendMessage = ({ conversationId, ...body }) => api.post(`/conversations/${conversationId}/messages`, body).then(data)
export const editMessage = ({ id, body }) => api.patch(`/messages/${id}`, { body }).then(data)
export const deleteMessage = ({ id, scope }) => api.delete(`/messages/${id}`, { params: { for: scope } }).then(data)
export const markRead = (id) => api.post(`/conversations/${id}/read`).then(data)
