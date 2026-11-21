import * as posts from '../services/post.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const latest = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await posts.latestPosts(req.query.limit) });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await posts.getPost(req.params.id) });
});

export const comments = asyncHandler(async (req, res) => {
  const { items, meta } = await posts.listComments(req.params.id, req.query);
  sendSuccess(res, { data: items, meta });
});

export const replies = asyncHandler(async (req, res) => {
  const { items, meta } = await posts.listCommentReplies(req.params.id, req.query);
  sendSuccess(res, { data: items, meta });
});
