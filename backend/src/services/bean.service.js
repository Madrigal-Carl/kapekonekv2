import { BEAN_CAP_KG, BEAN_STATUS_GROUPS } from '../constants/beans.js';
import { VARIETIES } from '../constants/catalog.js';
import * as repo from '../repositories/bean.repository.js';
import { nextSequence } from '../repositories/counter.repository.js';
import { findProfileScope, lockForBeanCap } from '../repositories/farmerProfile.repository.js';
import { inTransaction } from '../repositories/transaction.js';
import { findUserIdsByName } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { manilaDateKey } from '../utils/manilaDate.js';
import { record } from './audit.service.js';
import { isAssociationManager, isGroupManager, isOwner, seesEveryAssociation } from './policy.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

const AUDITED = ['farmer', 'variety', 'form', 'weightKg', 'pricePerKgCentavos', 'note'];
const notFound = () => new AppError(404, 'Listing not found.');
const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });
const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : null);
const person = (user) => (user ? { id: String(user._id), name: fullName(user), username: user.username } : null);
const idOf = (ref) => ref?._id ?? ref ?? null;
const label = (variety) => VARIETIES[variety] ?? variety;
const roleOf = (actor) => (seesEveryAssociation(actor) ? 'kaluppa' : isGroupManager(actor) ? 'group_manager' : 'farmer');

/** Who sees a listing: its farmer, the Group Manager of the association it was listed in, Kaluppa. */
const canSee = (actor, l) => seesEveryAssociation(actor) || isOwner(actor, { farmer: idOf(l.farmer) }) || isAssociationManager(actor, idOf(l.association));
/** Who lists and edits for a farmer: the farmer and their Group Manager (Kaluppa reviews instead). */
const sellsFor = (actor, l) => !seesEveryAssociation(actor) && (isOwner(actor, { farmer: idOf(l.farmer) }) || isAssociationManager(actor, idOf(l.association)));

const toDto = (l, actor) => ({
  id: String(l._id),
  listingNumber: l.listingNumber,
  farmer: person(l.farmer),
  association: l.association ? { id: String(l.association._id), name: l.association.name } : null,
  recordedBy: person(l.recordedBy),
  variety: l.variety,
  form: l.form,
  weightKg: l.weightKg,
  pricePerKgCentavos: l.pricePerKgCentavos,
  amountCentavos: Math.round(l.weightKg * l.pricePerKgCentavos),
  photos: l.photos.map(({ url, publicId }) => ({ url, publicId })),
  note: l.note,
  status: l.status,
  countsTowardCap: l.countsTowardCap,
  approvedAt: l.approvedAt,
  approvedBy: person(l.approvedBy),
  expiresAt: l.expiresAt,
  completion: l.completion,
  rejection: l.rejection ? { reason: l.rejection.reason, at: l.rejection.at } : null,
  cancellation: l.cancellation ? { reason: l.cancellation.reason, at: l.cancellation.at, byRole: l.cancellation.byRole } : null,
  history: l.history.map((h) => ({ action: h.action, at: h.at, by: person(h.by), byRole: h.byRole, note: h.note })),
  createdAt: l.createdAt,
  canEdit: l.status === 'pending' && sellsFor(actor, l),
});

const entity = (l) => ({ type: 'bean_listing', id: l._id, label: `${l.listingNumber} · ${l.weightKg} kg ${label(l.variety)}` });
const auditView = (l) => ({ ...Object.fromEntries(AUDITED.map((k) => [k, l[k] ?? null])), farmer: fullName(l.farmer) });

/** `BN-YYMM-NNNN`, one sequence per Manila calendar month. */
async function nextListingNumber() {
  const yymm = manilaDateKey().slice(2, 6);
  return `BN-${yymm}-${String(await nextSequence(`bean:${yymm}`)).padStart(4, '0')}`;
}

/**
 * Whose beans these are, and the association the listing is filed under (a snapshot: the farmer's approved or requested
 * association). A Group Manager lists for a farmer of its association, approved or waiting; anyone else is a 404.
 */
async function sellerFor(actor, farmerId) {
  if (isGroupManager(actor)) {
    if (!farmerId) throw fieldError('farmerId', 'Choose the farmer whose beans these are');
    const profile = await findProfileScope(farmerId);
    if (!['pending', 'approved'].includes(profile?.status) || !isAssociationManager(actor, profile.association)) throw new AppError(404, 'Farmer not found.');
    return { farmer: farmerId, association: profile.association };
  }
  const profile = await findProfileScope(actor._id);
  return { farmer: actor._id, association: ['pending', 'approved'].includes(profile?.status) ? profile.association : null };
}

const meter = (usedKg) => ({ capKg: BEAN_CAP_KG, usedKg, leftKg: Math.max(0, BEAN_CAP_KG - usedKg) });

/**
 * The 5 kg cap (PHASE-2-SPEC §3.5), inside the caller's transaction: lock the farmer, then sum what counts.
 * Approved farmers have no limit. Over the cap → 403 `BEAN_CAP_EXCEEDED` with the meter (`currentKg`: the edited
 * listing's weight, which the meter still includes).
 * @returns {Promise<{ countsTowardCap: boolean }>}
 */
async function checkCap(farmerId, weightKg, { session, excludeId, currentKg = 0 }) {
  if ((await lockForBeanCap(farmerId, session)) === 'approved') return { countsTowardCap: false };
  const usedKg = await repo.capUsedKg(farmerId, { excludeId, session });
  if (usedKg + weightKg <= BEAN_CAP_KG) return { countsTowardCap: true };
  const allowance = BEAN_CAP_KG - usedKg;
  const hint = allowance > 0
    ? `Over your limit. You can list up to ${allowance} kg more until you’re approved.`
    : `You’ve used the ${BEAN_CAP_KG} kg limit. You can list more once you’re approved.`;
  throw new AppError(403, `Unapproved farmers can sell up to ${BEAN_CAP_KG} kg.`, { code: 'BEAN_CAP_EXCEEDED', errors: { weightKg: hint }, data: meter(usedKg + currentKg) });
}

/** Photos from the uploader's own `bean_photo` folder, re-checked on Cloudinary; ones already on the listing stay as they are. */
async function photosFor(actor, photos, existing = []) {
  const kept = new Set(existing.map((p) => p.publicId));
  for (const photo of photos) {
    if (kept.has(photo.publicId)) continue;
    if (!isOwnUpload(actor, 'bean_photo', photo)) throw fieldError('photos', 'Upload these photos again.');
    await assertUploadAllowed('bean_photo', photo.publicId, 'photos');
  }
  return photos.map(({ url, publicId }) => ({ url, publicId }));
}

async function loadListing(actor, id) {
  const listing = await repo.findListingById(id);
  if (!listing || !canSee(actor, listing)) throw notFound();
  return listing;
}

/** @param {object} actor @param {{ q?: string, status?: string, variety?: string, form?: string, farmerId?: string, page: number, limit: number }} query */
export async function listListings(actor, { q, status, ...query }) {
  const scope = seesEveryAssociation(actor) ? {} : isGroupManager(actor) ? { association: actor.associationId ?? null } : { farmer: actor._id };
  const pattern = q ? containsPattern(q) : null;
  const search = pattern && {
    q: pattern,
    varieties: Object.keys(VARIETIES).filter((key) => pattern.test(VARIETIES[key])),
    farmerIds: await findUserIdsByName(q.split(/\s+/).map(containsPattern)),
  };
  const { items, meta } = await repo.listListings({ ...query, scope, statuses: status && BEAN_STATUS_GROUPS[status], search });
  return { items: items.map((l) => toDto(l, actor)), meta };
}

export const getListing = async (actor, id) => toDto(await loadListing(actor, id), actor);

/**
 * The cap meter for the farmer (or, with `farmerId`, a farmer a Group Manager or Kaluppa looks at).
 * @returns {Promise<{ capKg: number, usedKg: number, leftKg: number, approved: boolean }>}
 */
export async function getCap(actor, { farmerId }) {
  let farmer = actor._id;
  if (isGroupManager(actor)) farmer = (await sellerFor(actor, farmerId)).farmer;
  else if (seesEveryAssociation(actor)) {
    if (!farmerId) throw fieldError('farmerId', 'Choose a farmer');
    farmer = farmerId;
  }
  const [profile, usedKg] = await Promise.all([findProfileScope(farmer), repo.capUsedKg(farmer)]);
  return { ...meter(usedKg), approved: profile?.status === 'approved' };
}

/** List beans for Kaluppa: the farmer for themselves, or a Group Manager for a farmer it manages. */
export async function createListing(actor, { farmerId, photos, ...fields }) {
  if (seesEveryAssociation(actor)) throw new AppError(403, 'Kaluppa reviews bean listings; it doesn’t list beans.');
  const seller = await sellerFor(actor, farmerId);
  const checkedPhotos = await photosFor(actor, photos);
  const id = await inTransaction(async (session) => {
    const { countsTowardCap } = await checkCap(seller.farmer, fields.weightKg, { session });
    return repo.createListing({
      ...fields, ...seller, photos: checkedPhotos, countsTowardCap, recordedBy: actor._id, listingNumber: await nextListingNumber(),
      history: [{ action: 'listed', by: actor._id, byRole: roleOf(actor) }],
    }, session);
  });
  const listing = await repo.findListingById(id);
  await record({ actor, area: 'beans', action: 'create', entity: entity(listing), after: auditView(listing), fields: AUDITED });
  return toDto(listing, actor);
}

/** Edit a listing while it waits for review; a listing that counts toward the cap is checked again. */
export async function updateListing(actor, id, { farmerId: _ignored, photos, ...fields }) {
  const before = await loadListing(actor, id);
  if (!sellsFor(actor, before)) throw new AppError(403, 'You can’t change this listing.');
  const stillPending = () => new AppError(409, 'Only listings waiting for review can be edited.');
  if (before.status !== 'pending') throw stillPending();
  const checkedPhotos = await photosFor(actor, photos, before.photos);
  await inTransaction(async (session) => {
    if (before.countsTowardCap) await checkCap(idOf(before.farmer), fields.weightKg, { session, excludeId: before._id, currentKg: before.weightKg });
    if (!(await repo.updateListingWhen(before._id, { status: 'pending' }, { $set: { ...fields, photos: checkedPhotos } }, session))) throw stillPending();
  });
  const after = await repo.findListingById(id);
  await record({ actor, area: 'beans', action: 'update', entity: entity(after), before: auditView(before), after: auditView(after), fields: AUDITED });
  return toDto(after, actor);
}
