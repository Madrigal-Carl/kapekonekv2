import { anyListing, insertListings } from '../../repositories/bean.repository.js';
import { nextSequence } from '../../repositories/counter.repository.js';
import { findProfileByUser } from '../../repositories/farmerProfile.repository.js';
import { findUsersByUsernames } from '../../repositories/user.repository.js';
import { manilaDateKey } from '../../utils/manilaDate.js';
import { seedMedia } from './media.js';

const DAY = 86_400_000;
const ago = (days) => new Date(Date.now() - days * DAY);
const PHOTOS = { fresh_cherry: ['cherries-ripe', 'cherries-red'], dried_cherry: ['cherries-dark', 'green-beans-drying'], parchment: ['green-beans-drying', 'green-beans-washing'], green_beans: ['green-beans-heap', 'green-beans-bowls'] };

/**
 * PHASE-2-SPEC §8: listings in every status; one approved listing expiring within a day; farmer.pending (unapproved)
 * at 3 of 5 kg. `[farmer, variety, form, kg, ₱/kg, status, days since listed, extra]`; `by` lists for the farmer.
 */
const LISTINGS = [
  ['farmer.pending', 'liberica', 'dried_cherry', 2, 180, 'pending', 1, { note: 'Sun-dried 12 days, moisture around 12%' }],
  ['farmer.pending', 'liberica', 'fresh_cherry', 1, 120, 'completed', 20, { final: [1, 120] }],
  ['farmer.pending', 'excelsa', 'dried_cherry', 1.5, 170, 'cancelled', 12, { cancelledBy: 'farmer.pending' }],
  ['farmer.approved', 'excelsa', 'parchment', 30, 240, 'pending', 0.5, { note: 'Washed, dried on raised beds' }],
  ['farmer.approved', 'liberica', 'dried_cherry', 25, 190, 'approved', 7, { approvedDaysAgo: 6.1 }],
  ['farmer.approved', 'liberica', 'green_beans', 40, 320, 'completed', 9, { final: [39.2, 320] }],
  ['farmer.approved', 'robusta', 'dried_cherry', 15, 150, 'rejected', 15, { reason: 'Moisture too high for storage. Dry for 3 more days and list again.' }],
  ['nestor.perez', 'robusta', 'green_beans', 50, 260, 'approved', 3, { by: 'manager.santacruz', approvedDaysAgo: 2 }],
  ['lorna.ilagan', 'liberica', 'parchment', 20, 250, 'completed', 28, { final: [19.5, 250] }],
  ['lorna.ilagan', 'excelsa', 'dried_cherry', 10, 175, 'expired', 14, { approvedDaysAgo: 10 }],
  ['gina.tolentino', 'liberica', 'green_beans', 12, 300, 'cancelled', 8, { approvedDaysAgo: 7, cancelledBy: 'kaluppa', reason: 'Not brought within the agreed date' }],
  ['felix.rey', 'arabica', 'parchment', 12, 280, 'pending', 2, {}],
  ['felix.rey', 'arabica', 'green_beans', 60, 340, 'completed', 45, { final: [58.5, 340] }],
];

/** Bean listings for every status (bulk insert; numbers come from the shared counter so real listings never collide). Runs once. */
export async function seedBeans() {
  if (await anyListing()) return 'already seeded';
  const handles = [...new Set(['kaluppa', 'manager.santacruz', ...LISTINGS.map((l) => l[0])])];
  const users = Object.fromEntries((await findUsersByUsernames(handles)).map((u) => [u.username, u]));
  const kaluppa = users.kaluppa._id;
  const media = await seedMedia(); // the same verified Cloudinary copies the posts use
  const docs = [];
  // Oldest first, so listing numbers rise with the listing date.
  for (const [handle, variety, form, weightKg, pesos, status, listedDaysAgo, x] of [...LISTINGS].sort((a, b) => b[6] - a[6])) {
    const farmer = users[handle];
    const profile = await findProfileByUser(farmer._id);
    const recorder = x.by ? users[x.by] : farmer;
    const createdAt = ago(listedDaysAgo);
    const approvedAt = x.approvedDaysAgo != null ? ago(x.approvedDaysAgo) : ['approved', 'completed', 'expired'].includes(status) ? ago(listedDaysAgo - 1) : null;
    const history = [{ action: 'listed', at: createdAt, by: recorder._id, byRole: x.by ? 'group_manager' : 'farmer' }];
    if (approvedAt) history.push({ action: 'approved', at: approvedAt, by: kaluppa, byRole: 'kaluppa' });
    const doc = {
      listingNumber: `BN-${manilaDateKey(createdAt).slice(2, 6)}-${String(await nextSequence(`bean:${manilaDateKey(createdAt).slice(2, 6)}`)).padStart(4, '0')}`,
      farmer: farmer._id, association: profile?.association?._id ?? null, recordedBy: recorder._id,
      variety, form, weightKg, pricePerKgCentavos: pesos * 100, note: x.note ?? '',
      // A photo whose URL didn't answer is skipped (like imagesFor), so a flaky network never stops the seed.
      photos: PHOTOS[form].filter((key) => media[key]).map((key) => ({ url: media[key].url, publicId: media[key].publicId ?? `seed/${key}` })),
      status, countsTowardCap: profile?.status !== 'approved',
      approvedAt, approvedBy: approvedAt ? kaluppa : null, expiresAt: approvedAt ? new Date(approvedAt.getTime() + 7 * DAY) : null,
      createdAt, updatedAt: createdAt,
    };
    const closedAt = ago(Math.max(0, listedDaysAgo - 2));
    if (status === 'completed') {
      const [finalWeightKg, finalPesos] = x.final;
      doc.completion = { finalWeightKg, finalAmountCentavos: Math.round(finalWeightKg * finalPesos * 100), at: closedAt, by: kaluppa };
      history.push({ action: 'completed', at: closedAt, by: kaluppa, byRole: 'kaluppa' });
    }
    if (status === 'rejected') {
      doc.rejection = { reason: x.reason, at: closedAt, by: kaluppa };
      history.push({ action: 'rejected', at: closedAt, by: kaluppa, byRole: 'kaluppa', note: x.reason });
    }
    if (status === 'cancelled') {
      const by = users[x.cancelledBy];
      const byRole = x.cancelledBy === 'kaluppa' ? 'kaluppa' : 'farmer';
      doc.cancellation = { reason: x.reason ?? '', at: closedAt, by: by._id, byRole };
      history.push({ action: 'cancelled', at: closedAt, by: by._id, byRole, ...(x.reason && { note: x.reason }) });
    }
    if (status === 'expired') history.push({ action: 'expired', at: doc.expiresAt, by: null, byRole: 'system' });
    doc.history = history;
    docs.push(doc);
  }
  await insertListings(docs);
  return `${docs.length} bean listings`;
}
