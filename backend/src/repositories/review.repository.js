import mongoose from 'mongoose';
import { Review } from '../models/review.model.js';
import { pageList } from '../utils/pageList.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const PAGE = { sortField: 'createdAt', direction: 'desc' };

/** Newest-first cursor page of a product's reviews, with the reviewer's name and the order's fulfilment method. */
export async function listByProductCursor(productId, { cursor, limit }) {
  const docs = await Review.find({ product: productId, hiddenAt: null, ...cursorFilter({ ...PAGE, cursor }) })
    .sort(cursorSort(PAGE))
    .limit(limit + 1)
    .populate('buyer', 'firstName lastName')
    .populate('order', 'fulfillment.method')
    .lean();
  return pageResult(docs, limit, PAGE.sortField);
}

/**
 * Count of reviews per star.
 * @returns {Promise<Array<{ _id: number, count: number }>>}
 */
export const countByRating = (productId) =>
  Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(String(productId)), hiddenAt: null } },
    { $group: { _id: '$rating', count: { $sum: 1 } } },
  ]);

export const findByProductAndBuyer = (productId, buyerId) => Review.findOne({ product: productId, buyer: buyerId }).lean();

/** @param {{ product: unknown, buyer: unknown, order: unknown, rating: number, comment: string }} data */
export const createReview = async (data) => (await Review.create(data)).toObject();

/**
 * Update a review only if this buyer wrote it.
 * @returns {Promise<object|null>} null when it isn't theirs or doesn't exist
 */
export const updateOwnReview = (id, buyerId, changes) =>
  Review.findOneAndUpdate({ _id: id, buyer: buyerId }, { ...changes, editedAt: new Date() }, { returnDocument: 'after' }).lean();

/**
 * Delete a review only if this buyer wrote it.
 * @returns {Promise<object|null>} the deleted review, or null when it isn't theirs or doesn't exist
 */
export const deleteOwnReview = (id, buyerId) => Review.findOneAndDelete({ _id: id, buyer: buyerId }).lean();

/** Bulk insert (demo seeder). */
export const insertReviews = (reviews) => Review.insertMany(reviews);

/** Products that already have demo reviews. */
export const countReviews = () => Review.countDocuments();

// Kaluppa's moderation (PHASE-2-SPEC §3.8b).
const withPeople = (query) =>
  query
    .populate('buyer', 'firstName lastName roles avatar')
    .populate('product', 'name slug images variety coffeeType unitLabel')
    .populate('order', 'orderNumber')
    .populate('reply.by', 'firstName lastName')
    .populate('hiddenBy', 'firstName lastName');

/** One numbered page of reviews, newest first, with the people and product. */
export const listReviewsPage = (filter, paging) => pageList(withPeople(Review.find(filter).sort({ createdAt: -1, _id: -1 })), paging);

export const findReviewById = (id) => withPeople(Review.findById(id)).lean();

/** @returns {Promise<object|null>} the review after the change, populated */
export const updateReviewById = async (id, update) => ((await Review.updateOne({ _id: id }, update)).matchedCount ? findReviewById(id) : null);

/** Visible reviews without a reply yet (the sidebar badge). */
export const countNeedingReply = () => Review.countDocuments({ hiddenAt: null, reply: null });

/** Ids of every product with a review (the Product filter). */
export const listReviewedProductIds = () => Review.distinct('product');
