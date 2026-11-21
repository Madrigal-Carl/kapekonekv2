import { Order } from '../models/order.model.js';

/**
 * The buyer's most recent completed (sold) order containing this product — what unlocks a review.
 * @returns {Promise<{ _id: unknown, fulfillment: { method: string }, statusHistory: Array<{ status: string, at: Date }> } | null>}
 */
export const findLatestSoldOrderWithProduct = (buyerId, productId) =>
  Order.findOne({ buyer: buyerId, status: 'sold', 'items.product': productId }, { 'fulfillment.method': 1, statusHistory: 1 })
    .sort({ updatedAt: -1 })
    .lean();

/** Bulk insert (demo seeder). */
export const insertOrders = (orders) => Order.insertMany(orders);
