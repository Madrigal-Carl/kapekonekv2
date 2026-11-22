import { addToLine, clearCartItems, findCartLines, findLineQuantity, removeLine, setLineQuantity } from '../repositories/cart.repository.js';
import { QUANTITY_STEP, quantityRule, toSteps } from '../schemas/rules.js';
import { AppError } from '../utils/AppError.js';
import { getProductById, isPurchasable } from './catalog.service.js';

/** Stock as whole unit steps, rounded down (3.2 kg → 6 half-kilos). */
const stockSteps = (product) => Math.floor(product.stock / (QUANTITY_STEP[product.unit] ?? 1) + 1e-9);

/** Whether a line of `quantity` fits in the product's stock (integer step math). */
export const fitsStock = (product, quantity) => toSteps(product.unit, quantity) <= stockSteps(product);

/**
 * The one quantity rule for add, update and checkout: `resultingQty` must be on the unit's step and ≤ stock.
 * Never clamps. Over stock → 409 `QUANTITY_EXCEEDS_STOCK` with `{ stock, inCart, maxAddable }`.
 * @param {{ name: string, unit: string, stock: number }} product
 * @param {number} resultingQty the line's quantity after the change
 * @param {number} [inCart] the line's quantity before the change
 */
export function assertQuantityAllowed(product, resultingQty, inCart = 0) {
  const step = quantityRule(product.unit).safeParse(resultingQty);
  if (!step.success) throw new AppError(400, 'Please check the quantity.', { errors: { quantity: step.error.issues[0].message } });
  if (fitsStock(product, resultingQty)) return;
  const stepSize = QUANTITY_STEP[product.unit] ?? 1;
  const maxAddable = Math.max(0, stockSteps(product) - toSteps(product.unit, inCart)) * stepSize;
  const unit = product.unit === 'kg' ? ' kg' : '';
  throw new AppError(
    409,
    maxAddable > 0
      ? `Only ${product.stock}${unit} of ${product.name} in stock and you have ${inCart}${unit} in your cart. You can add up to ${maxAddable}${unit} more.`
      : `You already have all ${product.stock}${unit} of ${product.name} we have in your cart.`,
    { code: 'QUANTITY_EXCEEDS_STOCK', data: { stock: product.stock, inCart, maxAddable } },
  );
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
    else if (!fitsStock(product, quantity)) flags.push('OVER_STOCK');
    const key = String(product.category._id);
    if (!purchasable.has(key)) purchasable.set(key, await isPurchasable(user, product.category));
    if (!purchasable.get(key)) flags.push('NOT_PURCHASABLE');
    lines.push({ product: presentProduct(product), quantity, inCart: quantity, lineTotalCentavos: Math.round(product.priceCentavos * quantity), flags });
  }
  return {
    lines,
    count: lines.length,
    subtotalCentavos: lines.filter((l) => !l.flags.includes('INACTIVE')).reduce((sum, l) => sum + l.lineTotalCentavos, 0),
    canCheckout: lines.length > 0 && lines.every((l) => l.flags.length === 0),
  };
}

/** Add to the cart: the amount is added to an existing line, and the line's total must stay ≤ stock. */
export async function addItem(user, { productId, quantity }) {
  const product = await getProductById(user, productId);
  if (!product.purchasable) throw new AppError(403, "Your account can't buy this product.");
  if (product.stock <= 0) throw new AppError(409, `${product.name} is sold out.`);
  const inCart = await findLineQuantity(user._id, product._id);
  assertQuantityAllowed(product, inCart + quantity, inCart);
  if (!(await addToLine(user._id, product._id, quantity, product.stock))) {
    // A parallel add got there first: report the numbers as they are now.
    const now = await findLineQuantity(user._id, product._id);
    assertQuantityAllowed(product, now + quantity, now);
  }
  return getCart(user);
}

/** Set a line's quantity (PATCH): on the unit step and ≤ stock. */
export async function setQuantity(user, productId, quantity) {
  const line = (await findCartLines(user._id)).find((l) => l.product && String(l.product._id) === productId);
  if (!line) throw new AppError(404, "That item isn't in your cart.");
  assertQuantityAllowed(line.product, quantity, line.quantity);
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
