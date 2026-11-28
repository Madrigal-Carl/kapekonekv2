/** Change 08: farms are named by their property number; the lot number and its unique index go. */
export const name = '2026-11-28-drop-farm-lot-number';

export async function up(db) {
  const farms = db.collection('farms');
  const indexes = await farms.indexes().catch(() => []); // no collection yet: nothing to drop
  for (const index of indexes) if (index.key.lotNumber) await farms.dropIndex(index.name);
  await farms.updateMany({ lotNumber: { $exists: true } }, { $unset: { lotNumber: '' } });
}
