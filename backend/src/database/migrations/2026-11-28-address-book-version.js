/**
 * Change 08: every user gets `addressCount` (active addresses) and `addressesVersion`, so adding is one conditional
 * update (`addressCount < 10`) and a change made from a stale tab is refused (version check).
 */
export const name = '2026-11-28-address-book-version';

export async function up(db) {
  const counts = await db.collection('addresses').aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$user', n: { $sum: 1 } } }]).toArray();
  const users = db.collection('users');
  await users.updateMany({ addressCount: { $exists: false } }, { $set: { addressCount: 0 } });
  await users.updateMany({ addressesVersion: { $exists: false } }, { $set: { addressesVersion: 0 } });
  if (counts.length) await users.bulkWrite(counts.map((c) => ({ updateOne: { filter: { _id: c._id }, update: { $set: { addressCount: c.n } } } })));
}
