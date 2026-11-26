import { api } from '@/api/axios'

const page = (response) => ({ items: response.data.data, meta: response.data.meta })
const data = (response) => response.data.data

/** The landing page's 3 most-viewed posts of the last 30 days, each with `views`. */
export const topPosts = () => api.get('/posts/top').then(data)
export const getPost = (id) => api.get(`/posts/${id}`).then(data)
/** Top-level comments, oldest first, each with its first replies and `repliesNextCursor`. */
export const listComments = (postId, params) => api.get(`/posts/${postId}/comments`, { params }).then(page)
export const listReplies = (commentId, params) => api.get(`/comments/${commentId}/replies`, { params }).then(page)

// Hub (farmers, Group Managers, Kaluppa)
export const listFeed = (params) => api.get('/hub/posts', { params }).then(page)
export const tagCounts = () => api.get('/hub/tags').then(data)
export const createPost = (body) => api.post('/hub/posts', body).then(data)
export const updatePost = ({ id, ...body }) => api.patch(`/hub/posts/${id}`, body).then(data)
export const deletePost = (id) => api.delete(`/hub/posts/${id}`).then(data)
export const removePost = ({ id, reason }) => api.post(`/hub/posts/${id}/remove`, { reason }).then(data)
export const recordView = (id) => api.post(`/hub/posts/${id}/view`).then(data)

/** `target`: 'posts' or 'comments'; `type` null takes the reaction back. */
export const setReaction = ({ target, id, type }) =>
  (type ? api.put(`/${target}/${id}/reaction`, { type }) : api.delete(`/${target}/${id}/reaction`)).then(data)

export const addComment = ({ postId, body, parentId }) => api.post(`/posts/${postId}/comments`, { body, parentId }).then(data)
export const editComment = ({ id, body }) => api.patch(`/comments/${id}`, { body }).then(data)
export const deleteComment = (id) => api.delete(`/comments/${id}`).then(data)
export const removeComment = ({ id, reason }) => api.post(`/comments/${id}/remove`, { reason }).then(data)
