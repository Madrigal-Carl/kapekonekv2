import { PRODUCT_SORTS } from '../constants/catalog.js';
import { findLineQuantity } from '../repositories/cart.repository.js';
import { listCategories } from '../repositories/category.repository.js';
import { countProducts, findActiveById, findActiveBySlug, listProductsPage } from '../repositories/product.repository.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { userCan } from './permission.service.js';
const notFound = () => new AppError(404, "We couldn't find that product.");

/**
 * Can this viewer buy from the category? Guests can't (they're sent to sign in first).
 * @param {object|undefined} viewer req.user
 * @param {{ purchasePermission: string }} category
 */
export const isPurchasable = async (viewer, category) => Boolean(viewer) && userCan(viewer, category.purchasePermission);

/**
 * Categories the viewer may see: public ones, plus those whose purchase permission they hold.
 * @param {object|undefined} viewer
 */
export async function listVisibleCategories(viewer) {
  const categories = await listCategories();
  const visible = [];
  for (const category of categories) {
    if (category.isPublic || (await isPurchasable(viewer, category))) visible.push(category);
  }
  return visible;
}

/**
 * Categories the shop lists for this viewer (PHASE-2-SPEC §3.7): signed-in users see only what they may buy
 * (buyers Coffee, farmers Fertilizer and Seedlings); guests see the public ones. Product pages stay reachable by link.
 * @param {object|undefined} viewer
 */
async function listShopCategories(viewer) {
  if (!viewer) return (await listCategories()).filter((c) => c.isPublic);
  const shop = [];
  for (const category of await listCategories()) if (await isPurchasable(viewer, category)) shop.push(category);
  return shop;
}

const publicCategory = ({ _id, name, slug, hasVariety, hasCoffeeType }) => ({ _id, name, slug, hasVariety, hasCoffeeType });

/** @param {object|undefined} viewer */
export const listCategoriesFor = async (viewer) => (await listShopCategories(viewer)).map(publicCategory);

/** Add the viewer's `purchasable` flag and strip category internals. */
async function present(viewer, product, cache = new Map()) {
  const key = String(product.category._id);
  if (!cache.has(key)) cache.set(key, await isPurchasable(viewer, product.category));
  const { _id, name, slug } = product.category;
  return { ...product, category: { _id, name, slug }, purchasable: cache.get(key) };
}

/**
 * Cursor page of active products in visible categories. Prices are in pesos (the storefront filter's unit).
 * @param {object|undefined} viewer
 * @param {{ search?: string, category?: string, variety: string[], coffeeType: string[], minPrice?: number, maxPrice?: number, featured: boolean, sort: keyof PRODUCT_SORTS, cursor?: string, limit: number }} query
 */
export async function listProducts(viewer, { search, category, variety, coffeeType, minPrice, maxPrice, featured, sort, cursor, limit }) {
  const visible = await listShopCategories(viewer);
  const categoryIds = visible.filter((c) => !category || c.slug === category).map((c) => c._id);
  const filter = { isActive: true, category: { $in: categoryIds } };
  if (variety.length) filter.variety = { $in: variety };
  if (coffeeType.length) filter.coffeeType = { $in: coffeeType };
  if (minPrice != null || maxPrice != null) {
    filter.priceCentavos = { ...(minPrice != null && { $gte: minPrice * 100 }), ...(maxPrice != null && { $lte: maxPrice * 100 }) };
  }
  if (featured) filter.isFeatured = true;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: pattern }, { shortDescription: pattern }];
  }
  const [page, total] = await Promise.all([listProductsPage(filter, { ...PRODUCT_SORTS[sort], cursor, limit }), countProducts(filter)]);
  const cache = new Map();
  const items = [];
  for (const product of page.items) items.push(await present(viewer, product, cache));
  return { items, meta: { ...page.meta, total } };
}

/** An active product in a category the viewer can see, else 404. */
async function visibleOr404(viewer, product) {
  if (!product) throw notFound();
  const visible = await listVisibleCategories(viewer);
  if (!visible.some((c) => String(c._id) === String(product.category._id))) throw notFound();
  return present(viewer, product);
}

/**
 * Product detail, with `inCart` (how much of it is already in the viewer's cart; 0 for guests).
 * @param {object|undefined} viewer @param {string} slug
 */
export async function getProductBySlug(viewer, slug) {
  const product = await visibleOr404(viewer, await findActiveBySlug(slug));
  return { ...product, inCart: viewer ? await findLineQuantity(viewer._id, product._id) : 0 };
}

/** @param {object|undefined} viewer @param {string} id */
export const getProductById = async (viewer, id) => visibleOr404(viewer, await findActiveById(id));
