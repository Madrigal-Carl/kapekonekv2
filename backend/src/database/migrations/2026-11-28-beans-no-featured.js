/**
 * Change 08: the Seedlings category becomes Beans (kg and sack, no variety) and products lose the Featured flag.
 * Products already in the category keep their unit; editing one asks for kg or sack.
 */
export const name = '2026-11-28-beans-no-featured';

export async function up(db) {
  const categories = db.collection('categories');
  if (!(await categories.findOne({ slug: 'beans' }))) {
    await categories.updateOne({ slug: 'seedlings' }, { $set: { name: 'Beans', slug: 'beans', hasVariety: false } });
  }
  await db.collection('permissions').updateOne({ slug: 'catalog.farm_supplies' }, { $set: { name: 'Buy fertilizer and beans' } });
  await db.collection('products').updateMany({ isFeatured: { $exists: true } }, { $unset: { isFeatured: '' } });
}
