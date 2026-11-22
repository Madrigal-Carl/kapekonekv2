import * as catalog from '../services/catalog.service.js';
import * as reviews from '../services/review.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const categories = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await catalog.listCategoriesFor(req.user) });
});

export const products = asyncHandler(async (req, res) => {
  const { items, meta } = await catalog.listProducts(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const product = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await catalog.getProductBySlug(req.user, req.params.slug) });
});

export const productReviews = asyncHandler(async (req, res) => {
  const { items, meta } = await reviews.listReviews(req.user, req.params.id, req.query);
  sendSuccess(res, { data: items, meta });
});

export const reviewSummary = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reviews.getSummary(req.user, req.params.id) });
});

export const myReview = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reviews.getMyReview(req.user, req.params.id) });
});

export const createReview = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Thanks for your review.', data: await reviews.createReview(req.user, req.params.id, req.body) });
});

export const updateReview = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Your review was updated.', data: await reviews.updateReview(req.user, req.params.id, req.body) });
});

export const deleteReview = asyncHandler(async (req, res) => {
  await reviews.deleteReview(req.user, req.params.id);
  sendSuccess(res, { message: 'Your review was deleted.' });
});
