import * as posts from '../services/post.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const page = (res, { items, meta }) => sendSuccess(res, { data: items, meta });

export const top = asyncHandler(async (_req, res) => sendSuccess(res, { data: await posts.topPosts() }));
export const show = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.getPost(req.params.id, req.user) }));
export const comments = asyncHandler(async (req, res) => page(res, await posts.listComments(req.params.id, req.query, req.user)));
export const replies = asyncHandler(async (req, res) => page(res, await posts.listCommentReplies(req.params.id, req.query, req.user)));

export const feed = asyncHandler(async (req, res) => page(res, await posts.listFeed(req.user, req.query)));
export const tags = asyncHandler(async (_req, res) => sendSuccess(res, { data: await posts.tagCounts() }));
export const create = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, message: 'Posted to the Hub.', data: await posts.createPost(req.user, req.body) }));
export const update = asyncHandler(async (req, res) => sendSuccess(res, { message: 'Post updated.', data: await posts.updatePost(req.user, req.params.id, req.body) }));
export const destroy = asyncHandler(async (req, res) => {
  await posts.deletePost(req.user, req.params.id);
  sendSuccess(res, { message: 'Your post was deleted.' });
});
export const remove = asyncHandler(async (req, res) => {
  await posts.removePost(req.user, req.params.id, req.body);
  sendSuccess(res, { message: 'Post removed. The author was notified.' });
});
export const view = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.recordView(req.user, req.params.id) }));

export const reactPost = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.react(req.user, 'post', req.params.id, req.body.type) }));
export const unreactPost = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.unreact(req.user, 'post', req.params.id) }));
export const reactComment = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.react(req.user, 'comment', req.params.id, req.body.type) }));
export const unreactComment = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.unreact(req.user, 'comment', req.params.id) }));

export const addComment = asyncHandler(async (req, res) => sendSuccess(res, { status: 201, data: await posts.addComment(req.user, req.params.id, req.body) }));
export const editComment = asyncHandler(async (req, res) => sendSuccess(res, { data: await posts.editComment(req.user, req.params.id, req.body) }));
export const deleteComment = asyncHandler(async (req, res) => {
  await posts.deleteComment(req.user, req.params.id);
  sendSuccess(res, { message: 'Comment deleted.' });
});
export const removeComment = asyncHandler(async (req, res) => {
  await posts.removeComment(req.user, req.params.id, req.body);
  sendSuccess(res, { message: 'Comment removed. The author was notified.' });
});
