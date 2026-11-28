import { listCategories, upsertCategories } from '../../repositories/category.repository.js';

export const CATEGORIES = [
  { name: 'Coffee', slug: 'coffee', purchasePermission: 'catalog.coffee', isPublic: true, hasVariety: true, hasCoffeeType: true, sortOrder: 1 },
  { name: 'Fertilizer', slug: 'fertilizer', purchasePermission: 'catalog.farm_supplies', isPublic: false, hasVariety: false, hasCoffeeType: false, sortOrder: 2 },
  // Change 08: Seedlings became Beans (raw beans for farmers; still catalog.farm_supplies, so buyers never see it).
  { name: 'Beans', slug: 'beans', purchasePermission: 'catalog.farm_supplies', isPublic: false, hasVariety: false, hasCoffeeType: false, sortOrder: 3 },
];

/** Upsert the three categories by slug. */
export async function seedCategories() {
  await upsertCategories(CATEGORIES);
  return `${(await listCategories()).length} categories`;
}
