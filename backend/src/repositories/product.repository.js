import { Product } from '../models/product.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const CATEGORY_FIELDS = 'name slug purchasePermission isPublic';

/**
 * One cursor page of products matching `filter`.
 * @param {object} filter Mongo filter (already scoped to active, visible products)
 * @param {{ sortField: string, direction: 'asc'|'desc', cursor?: string, limit: number }} page
 */
export async function listProductsPage(filter, { sortField, direction, cursor, limit }) {
  const docs = await Product.find({ $and: [filter, cursorFilter({ sortField, direction, cursor })] })
    .sort(cursorSort({ sortField, direction }))
    .limit(limit + 1)
    .populate('category', CATEGORY_FIELDS)
    .lean();
  return pageResult(docs, limit, sortField);
}

/** @param {object} filter */
export const countProducts = (filter) => Product.countDocuments(filter);

/** An active product by slug, with its category. */
export const findActiveBySlug = (slug) => Product.findOne({ slug, isActive: true }).populate('category', CATEGORY_FIELDS).lean();

/** An active product by id, with its category. */
export const findActiveById = (id) => Product.findOne({ _id: id, isActive: true }).populate('category', CATEGORY_FIELDS).lean();

/** @param {{ average: number, count: number }} rating */
export const setProductRating = (productId, { average, count }) =>
  Product.updateOne({ _id: productId }, { ratingAverage: average, ratingCount: count });

/**
 * Upsert products by slug (seeder). Stock, ratings and sales are only set on insert, so a re-seed keeps live numbers.
 * @param {Array<{ slug: string, stock: number }>} products
 */
export const upsertProducts = (products) =>
  Product.bulkWrite(products.map(({ stock, ...p }) => ({
    updateOne: { filter: { slug: p.slug }, update: { $set: p, $setOnInsert: { stock } }, upsert: true },
  })));

/** @returns {Promise<Array<{ _id: unknown, slug: string, name: string, priceCentavos: number, unit: string, unitLabel: string|null, images: object[], variety: string|null, coffeeType: string|null }>>} */
export const listProductsByCategoryIds = (categoryIds) => Product.find({ category: { $in: categoryIds } }).lean();

/** Add to soldCount (demo seeding; M4 order completion). */
export const addSoldCount = (productId, quantity) => Product.updateOne({ _id: productId }, { $inc: { soldCount: quantity } });

/** Take `quantity` from stock only if enough is left. @returns {Promise<boolean>} */
export const reserveStock = async (productId, quantity) =>
  (await Product.updateOne({ _id: productId, stock: { $gte: quantity } }, { $inc: { stock: -quantity } })).modifiedCount === 1;

/** Put reserved stock back (cancel, reject, failed reserve). */
export const returnStock = (productId, quantity) => Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
