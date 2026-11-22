import { Cart } from '../models/cart.model.js';

const PRODUCT_FIELDS = 'name slug images priceCentavos unit unitLabel stock isActive variety coffeeType category';

/** The user's cart lines with products (and their categories) populated, oldest line first. */
export async function findCartLines(userId) {
  const cart = await Cart.findOne({ user: userId })
    .populate({ path: 'items.product', select: PRODUCT_FIELDS, populate: { path: 'category', select: 'name slug purchasePermission' } })
    .lean();
  return cart?.items ?? [];
}

/** Quantity of the product already in the user's cart (0 when there is no line). */
export async function findLineQuantity(userId, productId) {
  const cart = await Cart.findOne({ user: userId, 'items.product': productId }, { 'items.$': 1 }).lean();
  return cart?.items[0]?.quantity ?? 0;
}

/**
 * Add `quantity` to the product's line, creating the cart or line when missing. The merge only matches
 * while the line stays at or below `maxQuantity`, so two parallel adds can't push it past stock.
 * @returns {Promise<boolean>} false when the line would go over `maxQuantity`
 */
export async function addToLine(userId, productId, quantity, maxQuantity) {
  const guarded = { user: userId, items: { $elemMatch: { product: productId, quantity: { $lte: maxQuantity - quantity } } } };
  const merge = async () => (await Cart.updateOne(guarded, { $inc: { 'items.$.quantity': quantity } })).matchedCount > 0;
  if (await merge()) return true;
  if (quantity > maxQuantity) return false;
  try {
    await Cart.updateOne(
      { user: userId, 'items.product': { $ne: productId } },
      { $push: { items: { product: productId, quantity, addedAt: new Date() } } },
      { upsert: true },
    );
    return true;
  } catch (error) {
    // The cart already has this line (over the cap, or a parallel add made it first): the upsert hit the unique user index.
    if (error.code !== 11000) throw error;
    return merge();
  }
}

/** @returns {Promise<boolean>} false when the cart has no such line */
export const setLineQuantity = async (userId, productId, quantity) =>
  (await Cart.updateOne({ user: userId, 'items.product': productId }, { $set: { 'items.$.quantity': quantity } })).matchedCount > 0;

export const removeLine = (userId, productId) => Cart.updateOne({ user: userId }, { $pull: { items: { product: productId } } });

export const clearCartItems = (userId) => Cart.updateOne({ user: userId }, { $set: { items: [] } });
