import { categoryIdsBySlug } from '../../repositories/category.repository.js';
import { countProducts, upsertProducts } from '../../repositories/product.repository.js';
import { COFFEE, FERTILIZER, SEEDLINGS } from './data/products.js';
import { imagesFor, seedMedia } from './media.js';

/** Upsert the seed catalog by slug. Stock is only set when a product is first created. */
export async function seedProducts() {
  const [media, ids] = await Promise.all([seedMedia(), categoryIdsBySlug()]);
  if (!ids.coffee) throw new Error('Run the categories seeder first.');
  const rows = [
    ...COFFEE.map((p) => ({ ...p, category: ids.coffee })),
    ...FERTILIZER.map((p) => ({ ...p, category: ids.fertilizer })),
    ...SEEDLINGS.map((p) => ({ ...p, category: ids.seedlings })),
  ].map(({ media: keys, isFeatured = false, ...p }) => ({ ...p, isFeatured, isActive: true, images: imagesFor(media, keys) }));
  await upsertProducts(rows);
  return `${await countProducts({})} products`;
}
