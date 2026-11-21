import { addToLine, clearCartItems, findCartLines, removeLine, setLineQuantity } from '../repositories/cart.repository.js';
import { quantityRule } from '../schemas/rules.js';
import { AppError } from '../utils/AppError.js';
import { getProductById, isPurchasable } from './catalog.service.js';

/** 400 with `errors.quantity` when the quantity is off the unit's step. */
function assertQuantity(unit, quantity) {
  const result = quantityRule(unit).safeParse(quantity);
  if (!result.success) throw new AppError(400, 'Please check the quantity.', { errors: { quantity: result.error.issues[0].message } });
}

const presentProduct = ({ _id, name, slug, images, priceCentavos, unit, unitLabel, stock, variety, coffeeType, category }) => ({
  _id, name, slug, image: images?.[0]?.url ?? null, priceCentavos, unit, unitLabel, stock, variety, coffeeType,
  category: { _id: category._id, name: category.name, slug: category.slug },
});

/**
 * The cart with per-line flags. `canCheckout` needs at least one line and no flags anywhere.
 * Inactive (or deleted) products don't count toward the subtotal.
 * @param {{ _id: unknown }} user
 * @returns {Promise<{ lines: Array<{ product: object, quantity: number, lineTotalCentavos: number, flags: string[] }>, count: number, subtotalCentavos: number, canCheckout: boolean }>}
 */
export async function getCart(user) {
  const items = await findCartLines(user._id);
  const purchasable = new Map();
  const lines = [];
  for (const { product, quantity } of items) {
    if (!product) continue; // deleted product
    const flags = [];
    if (!product.isActive) flags.push('INACTIVE');
    else if (product.stock <= 0) flags.push('OUT_OF_STOCK');
    else if (quantity > product.stock) flags.push('OVER_STOCK');
    const key = String(product.category._id);
    if (!purchasable.has(key)) purchasable.set(key, await isPurchasable(user, product.category));
    if (!purchasable.get(key)) flags.push('NOT_PURCHASABLE');
    lines.push({ product: presentProduct(product), quantity, lineTotalCentavos: Math.round(product.priceCentavos * quantity), flags });
  }
  return {
    lines,
    count: lines.length,
    subtotalCentavos: lines.filter((l) => !l.flags.includes('INACTIVE')).reduce((sum, l) => sum + l.lineTotalCentavos, 0),
    canCheckout: lines.length > 0 && lines.every((l) => l.flags.length === 0),
  };
}

/** Add to the cart (merging into an existing line). The product must be visible, purchasable and in stock. */
export async function addItem(user, { productId, quantity }) {
  const product = await getProductById(user, productId);
  if (!product.purchasable) throw new AppError(403, "Your account can't buy this product.");
  assertQuantity(product.unit, quantity);
  if (product.stock <= 0) throw new AppError(409, `${product.name} is sold out.`);
  await addToLine(user._id, product._id, quantity);
  return getCart(user);
}

export async function setQuantity(user, productId, quantity) {
  const line = (await findCartLines(user._id)).find((l) => l.product && String(l.product._id) === productId);
  if (!line) throw new AppError(404, "That item isn't in your cart.");
  assertQuantity(line.product.unit, quantity);
  await setLineQuantity(user._id, productId, quantity);
  return getCart(user);
}

export async function removeItem(user, productId) {
  await removeLine(user._id, productId);
  return getCart(user);
}

export async function clearCart(user) {
  await clearCartItems(user._id);
  return getCart(user);
}
