import { findLatestSoldOrderWithProduct } from '../repositories/order.repository.js';
import { setProductRating } from '../repositories/product.repository.js';
import {
  countByRating, createReview as insertReview, findByProductAndBuyer, listByProductCursor, updateOwnReview,
} from '../repositories/review.repository.js';
import { AppError } from '../utils/AppError.js';
import { authorCard } from '../utils/authorCard.js';
import { getProductById } from './catalog.service.js';
import { userCan } from './permission.service.js';

const present = ({ _id, rating, comment, createdAt, editedAt, buyer, order }) => ({
  _id, rating, comment, createdAt, editedAt, author: authorCard(buyer), fulfillment: order?.fulfillment?.method ?? null,
});

const soldAt = (order) => order.statusHistory.findLast((h) => h.status === 'sold')?.at ?? null;

/**
 * Newest-first page of a product's reviews.
 * @param {object|undefined} viewer
 * @param {string} productId
 * @param {{ cursor?: string, limit: number }} page
 */
export async function listReviews(viewer, productId, page) {
  await getProductById(viewer, productId);
  const { items, meta } = await listByProductCursor(productId, page);
  return { items: items.map(present), meta };
}

/**
 * Average (1 dp), count and per-star distribution.
 * @returns {Promise<{ average: number, count: number, distribution: Record<1|2|3|4|5, number> }>}
 */
export async function getSummary(viewer, productId) {
  await getProductById(viewer, productId);
  return summarize(await countByRating(productId));
}

function summarize(rows) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of rows) distribution[row._id] = row.count;
  const count = rows.reduce((n, r) => n + r.count, 0);
  const sum = rows.reduce((n, r) => n + r._id * r.count, 0);
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, distribution };
}

/** Recompute `ratingAverage` (1 dp) and `ratingCount` on the product. */
export async function recomputeRating(productId) {
  const { average, count } = summarize(await countByRating(productId));
  await setProductRating(productId, { average, count });
}

/**
 * The viewer's own review and whether they may write one (a completed order of the product, no review yet).
 * @returns {Promise<{ review: object|null, canReview: boolean, order: { method: string, soldAt: Date|null } | null }>}
 */
export async function getMyReview(user, productId) {
  await getProductById(user, productId);
  const [review, order] = await Promise.all([findByProductAndBuyer(productId, user._id), findLatestSoldOrderWithProduct(user._id, productId)]);
  const canReview = !review && Boolean(order) && (await userCan(user, 'reviews.create'));
  return { review, canReview, order: order && { method: order.fulfillment.method, soldAt: soldAt(order) } };
}

/** Create the buyer's one review of a product they received. */
export async function createReview(user, productId, { rating, comment }) {
  await getProductById(user, productId);
  const order = await findLatestSoldOrderWithProduct(user._id, productId);
  if (!order) throw new AppError(403, 'You can review this once an order of it is completed.');
  if (await findByProductAndBuyer(productId, user._id)) throw new AppError(409, 'You already reviewed this product. Edit your review instead.');
  const review = await insertReview({ product: productId, buyer: user._id, order: order._id, rating, comment });
  await recomputeRating(productId);
  return review;
}

/** Edit the buyer's own review. */
export async function updateReview(user, reviewId, changes) {
  const review = await updateOwnReview(reviewId, user._id, changes);
  if (!review) throw new AppError(404, "We couldn't find that review.");
  await recomputeRating(review.product);
  return review;
}
