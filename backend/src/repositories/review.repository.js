import mongoose from 'mongoose';
import { Review } from '../models/review.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const PAGE = { sortField: 'createdAt', direction: 'desc' };

/** Newest-first cursor page of a product's reviews, with the reviewer's name and the order's fulfilment method. */
export async function listByProductCursor(productId, { cursor, limit }) {
  const docs = await Review.find({ product: productId, ...cursorFilter({ ...PAGE, cursor }) })
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
    { $match: { product: new mongoose.Types.ObjectId(String(productId)) } },
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

/** Bulk insert (demo seeder). */
export const insertReviews = (reviews) => Review.insertMany(reviews);

/** Products that already have demo reviews. */
export const countReviews = () => Review.countDocuments();
