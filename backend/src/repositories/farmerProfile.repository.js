import { FarmerProfile } from '../models/farmerProfile.model.js';
import { associationMatch } from '../utils/reportQuery.js';

const ASSOCIATIONS = [
  { path: 'association', select: 'name municipality groupManager groupChat archivedAt' },
  { path: 'transferRequest.association', select: 'name municipality groupManager groupChat' },
];

/**
 * Approved and waiting farmers per association.
 * @returns {Promise<Map<string, { approved: number, pending: number }>>}
 */
export async function countFarmersByAssociation(associationIds) {
  const rows = await FarmerProfile.aggregate([
    { $match: { association: { $in: associationIds }, status: { $in: ['approved', 'pending'] } } },
    { $group: { _id: { association: '$association', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const counts = new Map(associationIds.map((id) => [String(id), { approved: 0, pending: 0 }]));
  for (const { _id, n } of rows) counts.get(String(_id.association))[_id.status] = n;
  return counts;
}

/** User ids of the association's approved farmers. */
export const findApprovedFarmerIds = async (associationId) =>
  (await FarmerProfile.find({ association: associationId, status: 'approved' }, 'user').lean()).map((p) => p.user);

/** Create the profile every farmer account has (no-op when it exists). */
export const ensureProfile = (userId, fields = {}) =>
  FarmerProfile.updateOne({ user: userId }, { $setOnInsert: { user: userId, ...fields } }, { upsert: true });

/** The farmer's profile with its association (and the transfer target) populated. */
export const findProfileByUser = (userId) => FarmerProfile.findOne({ user: userId }).populate(ASSOCIATIONS).lean();

/** Just status and association, for the session scope. */
export const findProfileScope = (userId) => FarmerProfile.findOne({ user: userId }, 'status association').lean();

/**
 * Apply `update` only when the profile still matches `when` (decisions happen once).
 * @returns {Promise<object|null>} the updated profile, or null when it no longer matched
 */
export const updateProfileWhen = (userId, when, update) =>
  FarmerProfile.findOneAndUpdate({ user: userId, ...when }, update, { returnDocument: 'after' }).populate(ASSOCIATIONS).lean();

/**
 * User ids in a Group Manager's scope: farmers of the association (any status) plus incoming transfers.
 * `associationId` null = every farmer (Kaluppa).
 * @param {{ associationId: unknown|null, status?: string }} scope
 */
export async function findFarmerIdsInScope({ associationId, status }) {
  const mine = associationId ? { association: associationId } : {};
  const incoming = { 'transferRequest.association': associationId ?? { $ne: null } };
  const filter = {
    pending: { $or: [{ ...mine, status: 'pending' }, incoming] }, // "Waiting for approval" includes transfers in
    approved: { ...mine, status: 'approved' },
    rejected: { ...mine, status: 'rejected' },
  }[status] ?? { $or: [{ ...mine, status: { $ne: 'none' } }, incoming] };
  // shortcut: ids fit in memory at association scale; switch to a $lookup pipeline if Kaluppa's list grows past ~50k farmers.
  return (await FarmerProfile.find(filter, 'user').lean()).map((p) => p.user);
}

export const findProfilesByUsers = (userIds) => FarmerProfile.find({ user: { $in: userIds } }).populate(ASSOCIATIONS).lean();

const waitingIn = (associationId) => ({
  $or: [{ association: associationId, status: 'pending' }, { 'transferRequest.association': associationId }],
});

/** Requests and transfers waiting for this association's decision. */
export const countWaiting = (associationId) => FarmerProfile.countDocuments(waitingIn(associationId));

/** The oldest waiting requests, with the farmer's name. */
export const listWaiting = (associationId, limit) =>
  FarmerProfile.find(waitingIn(associationId)).sort({ requestedAt: 1, _id: 1 }).limit(limit)
    .populate('user', 'firstName lastName').populate('association', 'name').populate('transferRequest.association', 'name').lean();

/** Approved and waiting farmers across every association. */
export async function countFarmersEverywhere() {
  const [approved, waiting] = await Promise.all([
    FarmerProfile.countDocuments({ status: 'approved' }),
    FarmerProfile.countDocuments({ $or: [{ status: 'pending' }, { transferRequest: { $ne: null } }] }),
  ]);
  return { approved, waiting };
}

/**
 * Take the farmer's bean-cap lock inside a transaction: the write makes a second listing transaction for the same
 * farmer conflict and retry after this one commits (PHASE-2-SPEC §3.5). Returns the profile's current status.
 * @param {unknown} userId
 * @param {import('mongoose').ClientSession} session
 * @returns {Promise<'none'|'pending'|'approved'|'rejected'>}
 */
export const lockForBeanCap = async (userId, session) =>
  (await FarmerProfile.findOneAndUpdate({ user: userId }, { $inc: { capLock: 1 } }, { session, upsert: true, returnDocument: 'after', projection: 'status' }).lean()).status;

/** Reports: approved farmers in scope with their names, association and approval time. @param {string|null|undefined} association */
export const listApprovedFarmers = (association) =>
  FarmerProfile.find({ ...associationMatch(association), status: 'approved' }, 'user association approvedAt').populate('user', 'firstName lastName').lean();
