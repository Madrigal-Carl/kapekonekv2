import { Cart } from '../models/cart.model.js';

const PRODUCT_FIELDS = 'name slug images priceCentavos unit unitLabel stock isActive variety coffeeType category';

/** The user's cart lines with products (and their categories) populated, oldest line first. */
export async function findCartLines(userId) {
  const cart = await Cart.findOne({ user: userId })
    .populate({ path: 'items.product', select: PRODUCT_FIELDS, populate: { path: 'category', select: 'name slug purchasePermission' } })
    .lean();
  return cart?.items ?? [];
}

/** Add `quantity` to the product's line, creating the cart or line when missing. */
export async function addToLine(userId, productId, quantity) {
  const merged = await Cart.updateOne({ user: userId, 'items.product': productId }, { $inc: { 'items.$.quantity': quantity } });
  if (merged.matchedCount) return;
  try {
    await Cart.updateOne(
      { user: userId, 'items.product': { $ne: productId } },
      { $push: { items: { product: productId, quantity, addedAt: new Date() } } },
      { upsert: true },
    );
  } catch (error) {
    // A parallel add created the line first (the upsert hit the unique user index): merge into it.
    if (error.code !== 11000) throw error;
    await Cart.updateOne({ user: userId, 'items.product': productId }, { $inc: { 'items.$.quantity': quantity } });
  }
}

/** @returns {Promise<boolean>} false when the cart has no such line */
export const setLineQuantity = async (userId, productId, quantity) =>
  (await Cart.updateOne({ user: userId, 'items.product': productId }, { $set: { 'items.$.quantity': quantity } })).matchedCount > 0;

export const removeLine = (userId, productId) => Cart.updateOne({ user: userId }, { $pull: { items: { product: productId } } });

export const clearCartItems = (userId) => Cart.updateOne({ user: userId }, { $set: { items: [] } });
