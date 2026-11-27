import mongoose from 'mongoose';
import { CAP_STATUSES } from '../constants/beans.js';
import { BeanListing } from '../models/beanListing.model.js';
import { pageList } from '../utils/pageList.js';
import { associationMatch, manilaMonth } from '../utils/reportQuery.js';

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

/** Cap kilograms used per farmer, for a page of farmers. @returns {Promise<Map<string, number>>} */
export async function capUsedKgByFarmers(farmerIds) {
  const rows = await BeanListing.aggregate([
    { $match: { farmer: { $in: farmerIds.map(oid) }, countsTowardCap: true, status: { $in: CAP_STATUSES } } },
    { $group: { _id: '$farmer', kg: { $sum: '$weightKg' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.kg]));
}

/** Final kilograms of the farmer's completed sales since a date. */
export async function soldKgSince(farmerId, since) {
  const [row] = await BeanListing.aggregate([
    { $match: { farmer: oid(farmerId), status: 'completed', 'completion.at': { $gte: since } } },
    { $group: { _id: null, kg: { $sum: '$completion.finalWeightKg' } } },
  ]);
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

/** Completed sales in scope in [from, to): when and the final kilograms (overview charts). */
export const completedRows = (scope, from, to) =>
  BeanListing.find({ ...scope, status: 'completed', 'completion.at': { $gte: from, $lt: to } }).select('completion.at completion.finalWeightKg').lean();

/** Listings waiting for review in scope: how many and their kilograms. */
export async function pendingTotals(scope) {
  const [row] = await BeanListing.aggregate([{ $match: { ...scope, status: 'pending' } }, { $group: { _id: null, count: { $sum: 1 }, kg: { $sum: '$weightKg' } } }]);
  return { count: row?.count ?? 0, kg: row?.kg ?? 0 };
}

/** The newest listings in scope, optionally only some statuses. */
export const recentListings = (scope, limit, statuses) =>
  BeanListing.find({ ...scope, ...(statuses && { status: { $in: statuses } }) }).sort({ createdAt: -1, _id: -1 }).limit(limit).populate(POPULATE).lean();

/**
 * Reports: completed sales in scope in [from, to) — kg per Manila month, and kg and pesos paid per group (`$facet`).
 * @param {string|null|undefined} association @param {{ from: Date, to: Date }} range @param {'$association'|'$farmer'} group
 */
export async function beanReport(association, range, group) {
  const [facets] = await BeanListing.aggregate([
    { $match: { ...associationMatch(association), status: 'completed', 'completion.at': { $gte: range.from, $lt: range.to } } },
    {
      $facet: {
        months: [{ $group: { _id: manilaMonth('$completion.at'), kg: { $sum: '$completion.finalWeightKg' } } }],
        groups: [{ $group: { _id: group, kg: { $sum: '$completion.finalWeightKg' }, paid: { $sum: '$completion.finalAmountCentavos' } } }],
      },
    },
  ]);
  return facets;
}
