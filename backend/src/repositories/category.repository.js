import { Category } from '../models/category.model.js';

/** Every category in display order. */
export const listCategories = () => Category.find().sort({ sortOrder: 1, name: 1 }).lean();

/**
 * Upsert categories by slug (seeder).
 * @param {Array<{ slug: string }>} categories
 */
export const upsertCategories = (categories) =>
  Category.bulkWrite(categories.map((c) => ({ updateOne: { filter: { slug: c.slug }, update: { $set: c }, upsert: true } })));

/** @returns {Promise<Record<string, unknown>>} slug → _id */
export const categoryIdsBySlug = async () =>
  Object.fromEntries((await Category.find({}, { slug: 1 }).lean()).map((c) => [c.slug, c._id]));
