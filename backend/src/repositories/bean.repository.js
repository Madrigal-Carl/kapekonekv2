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
