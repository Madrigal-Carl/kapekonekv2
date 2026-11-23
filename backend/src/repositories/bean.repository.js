import mongoose from 'mongoose';
import { CAP_STATUSES } from '../constants/beans.js';
import { BeanListing } from '../models/beanListing.model.js';
import { pageList } from '../utils/pageList.js';

// aggregate() doesn't cast like find() does; ids from a request body or query arrive as strings.
const oid = (id) => new mongoose.Types.ObjectId(String(id));
const PEOPLE = 'firstName lastName username';
const POPULATE = [
  { path: 'farmer', select: PEOPLE },
  { path: 'association', select: 'name' },
  { path: 'recordedBy', select: PEOPLE },
  { path: 'approvedBy', select: PEOPLE },
  { path: 'history.by', select: PEOPLE },
];

export const findListingById = (id) => BeanListing.findById(id).populate(POPULATE).lean();

/**
 * Kilograms of the farmer's listings that use up the cap.
 * @param {unknown} farmerId
 * @param {{ excludeId?: unknown, session?: import('mongoose').ClientSession }} [options]
 */
export async function capUsedKg(farmerId, { excludeId, session } = {}) {
  const match = { farmer: oid(farmerId), countsTowardCap: true, status: { $in: CAP_STATUSES }, ...(excludeId && { _id: { $ne: oid(excludeId) } }) };
  const [row] = await BeanListing.aggregate([{ $match: match }, { $group: { _id: null, kg: { $sum: '$weightKg' } } }]).session(session ?? null);
  return row?.kg ?? 0;
}

/** @returns {Promise<unknown>} the new listing's id */
export const createListing = async (data, session) => (await BeanListing.create([data], { session }))[0]._id;

/**
 * Change a listing only while it still matches `when` (e.g. `{ status: 'pending' }`), so decisions happen once.
 * @returns {Promise<boolean>} whether it matched
 */
export const updateListingWhen = async (id, when, update, session) =>
  (await BeanListing.updateOne({ _id: id, ...when }, update, { session, runValidators: true })).modifiedCount === 1;

/**
 * One page of listings, newest first.
 * @param {{ scope: object, statuses?: string[], variety?: string, form?: string, farmerId?: string,
 *   search?: { q: RegExp, varieties: string[], farmerIds: unknown[] }, page: number, limit: number }} query
 */
export function listListings({ scope, statuses, variety, form, farmerId, search, page, limit }) {
  const filter = {
    ...scope,
    ...(statuses && { status: { $in: statuses } }),
    ...(variety && { variety }),
    ...(form && { form }),
    ...(farmerId && { farmer: farmerId }),
    ...(search && { $or: [{ listingNumber: search.q }, { variety: { $in: search.varieties } }, { farmer: { $in: search.farmerIds } }] }),
  };
  return pageList(BeanListing.find(filter).sort({ createdAt: -1, _id: -1 }).populate(POPULATE), { page, limit });
}

/** Ids of approved listings whose drop-off deadline has passed. */
export const findOverdueIds = (now) => BeanListing.find({ status: 'approved', expiresAt: { $lte: now } }).distinct('_id');

export const countPendingListings = () => BeanListing.countDocuments({ status: 'pending' });

/**
 * Kaluppa's bean tiles in one pass: waiting for review, waiting for drop-off, bought since `monthStart`, and the
 * completed weight and amount since `since` (for the average price).
 * @param {{ monthStart: Date, since: Date }} range
 */
export async function beanTiles({ monthStart, since }) {
  const sum = (field) => ({ $sum: field });
  const [row] = await BeanListing.aggregate([
    {
      $facet: {
        toReview: [{ $match: { status: 'pending' } }, { $group: { _id: null, count: sum(1), kg: sum('$weightKg') } }],
        waiting: [{ $match: { status: 'approved' } }, { $group: { _id: null, count: sum(1), kg: sum('$weightKg'), nextExpiresAt: { $min: '$expiresAt' } } }],
        month: [{ $match: { status: 'completed', 'completion.at': { $gte: monthStart } } }, { $group: { _id: null, kg: sum('$completion.finalWeightKg'), paid: sum('$completion.finalAmountCentavos') } }],
        recent: [{ $match: { status: 'completed', 'completion.at': { $gte: since } } }, { $group: { _id: null, kg: sum('$completion.finalWeightKg'), paid: sum('$completion.finalAmountCentavos') } }],
      },
    },
  ]);
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v[0] ?? null]));
}

/** Seeds only: is there any listing yet? */
export const anyListing = async () => Boolean(await BeanListing.exists({}));

/** Seeds only: bulk insert (no audit entries, like the seeded harvests). */
export const insertListings = (docs) => BeanListing.insertMany(docs);
