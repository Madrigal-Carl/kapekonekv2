import * as moderation from '../services/reviewModeration.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await moderation.listAdminReviews(req.query);
  sendSuccess(res, { data: items, meta });
});

export const products = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await moderation.listReviewedProducts() });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await moderation.getAdminReview(req.params.id) });
});

export const reply = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Reply posted under the review.', data: await moderation.saveReply(req.user, req.params.id, req.body) });
});

export const deleteReply = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Reply deleted.', data: await moderation.deleteReply(req.user, req.params.id) });
});

export const hide = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Review hidden. The reviewer was notified.', data: await moderation.setHidden(req.user, req.params.id, true, req.body.reason) });
});

export const unhide = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Review is visible again.', data: await moderation.setHidden(req.user, req.params.id, false) });
});
