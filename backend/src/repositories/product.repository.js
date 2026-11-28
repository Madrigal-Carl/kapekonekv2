import { Product } from '../models/product.model.js';
import { pageList } from '../utils/pageList.js';
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
export const findActiveBySlug = (slug) => Product.findOne({ slug, isActive: true, archivedAt: null }).populate('category', CATEGORY_FIELDS).lean();

/** An active product by id, with its category. */
export const findActiveById = (id) => Product.findOne({ _id: id, isActive: true, archivedAt: null }).populate('category', CATEGORY_FIELDS).lean();

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

/** Active products at or below the low-stock line (Change 08: 10 for every category). */
export const findLowStock = (limit, line) =>
  Product.find({ isActive: true, archivedAt: null, stock: { $lte: line } })
    .sort({ stock: 1 }).limit(limit).populate('category', 'slug').select('name slug stock unit unitLabel category').lean();

/** Active products among `ids`, with their category (best sellers). */
export const findActiveByIds = (ids) => Product.find({ _id: { $in: ids }, isActive: true, archivedAt: null }).populate('category', CATEGORY_FIELDS).lean();

/** The newest active products in these categories, except `exceptIds` (best sellers fill their gaps with them). */
export const listNewestActive = (categoryIds, exceptIds, limit) =>
  Product.find({ category: { $in: categoryIds }, _id: { $nin: exceptIds }, isActive: true, archivedAt: null })
    .sort({ createdAt: -1, _id: -1 }).limit(limit).populate('category', CATEGORY_FIELDS).lean();

/** Inventory: one numbered page of products, newest first, with their category. */
export const listInventoryPage = (filter, paging) =>
  pageList(Product.find(filter).sort({ createdAt: -1, _id: -1 }).populate('category', CATEGORY_FIELDS), paging);

/** Any product by id (archived or not), with its category. */
export const findProductById = (id) => Product.findById(id).populate('category', CATEGORY_FIELDS).lean();

/** @param {string} slug @returns {Promise<boolean>} */
export const slugTaken = async (slug) => Boolean(await Product.exists({ slug }));

export const createProduct = async (fields) => findProductById((await Product.create(fields))._id);

/** @returns {Promise<object|null>} the product after the change */
export const updateProduct = async (id, set) => {
  await Product.updateOne({ _id: id }, { $set: set });
  return findProductById(id);
};

/** `{ _id, name }` of these products, by name. */
export const findProductNames = (ids) => Product.find({ _id: { $in: ids } }, 'name').sort({ name: 1 }).lean();

/** Ids of products whose name matches. @param {RegExp} pattern */
export const findProductIdsByName = (pattern) => Product.find({ name: pattern }).distinct('_id');
