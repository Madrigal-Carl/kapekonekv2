import { FINAL_STATUSES } from '../constants/orderStatus.js';
import { Order } from '../models/order.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const NEWEST = { sortField: 'createdAt', direction: 'desc' };

/**
 * The buyer's most recent completed (sold) order containing this product — what unlocks a review.
 * @returns {Promise<{ _id: unknown, fulfillment: { method: string }, statusHistory: Array<{ status: string, at: Date }> } | null>}
 */
export const findLatestSoldOrderWithProduct = (buyerId, productId) =>
  Order.findOne({ buyer: buyerId, status: 'sold', 'items.product': productId }, { orderNumber: 1, 'fulfillment.method': 1, statusHistory: 1 })
    .sort({ updatedAt: -1 })
    .lean();

/** The buyer's newest order of a product that is still on its way (not sold, cancelled, rejected or expired). */
export const findOpenOrderWithProduct = (buyerId, productId) =>
  Order.findOne({ buyer: buyerId, status: { $nin: FINAL_STATUSES }, 'items.product': productId }, { orderNumber: 1 })
    .sort({ createdAt: -1 })
    .lean();

/** Bulk insert (demo seeder). */
export const insertOrders = (orders) => Order.insertMany(orders);

/** Total orders (demo seeder's "already seeded" check). */
export const countOrders = () => Order.countDocuments();

/** @param {object} doc */
export const createOrder = async (doc) => (await Order.create(doc)).toObject();

export const findOrderById = (id) => Order.findById(id).lean();

/**
 * A buyer's orders, newest first, one cursor page.
 * @param {unknown} buyerId
 * @param {{ statuses: string[], cursor?: string, limit: number }} page
 */
export async function listByBuyerCursor(buyerId, { statuses, cursor, limit }) {
  const filter = { buyer: buyerId, ...(statuses.length && { status: { $in: statuses } }) };
  const docs = await Order.find({ $and: [filter, cursorFilter({ ...NEWEST, cursor })] }).sort(cursorSort(NEWEST)).limit(limit + 1).lean();
  return pageResult(docs, limit, NEWEST.sortField);
}

/** @returns {Promise<Array<{ _id: string, n: number }>>} order count per status for one buyer */
export const countByStatusForBuyer = (buyerId) => Order.aggregate([{ $match: { buyer: buyerId } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);

/**
 * Apply `update` only while the order still matches `where` (e.g. its current status).
 * @param {unknown} id
 * @param {object} where extra filter, usually `{ status }`
 * @param {object} update Mongo update
 * @param {'before'|'after'} [returnDocument]
 * @returns {Promise<object|null>} null when the order changed meanwhile
 */
export const updateOrderIf = (id, where, update, returnDocument = 'after') =>
  Order.findOneAndUpdate({ _id: id, ...where }, update, { returnDocument }).lean();

/** Ids of pending orders placed before `cutoff` (expiry sweep). */
export const findExpirableIds = async (cutoff) =>
  (await Order.find({ status: 'pending', createdAt: { $lt: cutoff } }).select('_id').lean()).map((o) => o._id);
