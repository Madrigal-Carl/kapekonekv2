import { api } from '@/api/axios'

const page = (response) => ({ items: response.data.data, meta: response.data.meta })
const data = (response) => response.data.data

export const latestPosts = (limit = 3) => api.get('/posts/latest', { params: { limit } }).then(data)
export const getPost = (id) => api.get(`/posts/${id}`).then(data)
/** Top-level comments, oldest first, each with its first replies and `repliesNextCursor`. */
export const listComments = (postId, params) => api.get(`/posts/${postId}/comments`, { params }).then(page)
export const listReplies = (commentId, params) => api.get(`/comments/${commentId}/replies`, { params }).then(page)
