import mongoose from 'mongoose';
import { Farm } from '../models/farm.model.js';
import { pageList } from '../utils/pageList.js';

const PEOPLE = 'firstName lastName username';
const POPULATE = [
  { path: 'owner', select: PEOPLE },
  { path: 'association', select: 'name' },
  { path: 'managedBy', select: PEOPLE },
  { path: 'assignedFarmers', select: PEOPLE },
];
const populated = (query) => query.populate(POPULATE).lean();

/**
 * Whose farms: `{}` every farm; `{ ownerId }` one owner's; `{ associationId, managerId }` an association's farmer
 * farms plus the Kaluppa farms that Group Manager manages.
 */
function scopeFilter({ ownerId, associationId, managerId }) {
  if (ownerId) return { owner: ownerId };
  if (managerId) return { $or: [...(associationId ? [{ ownerType: 'farmer', association: associationId }] : []), { managedBy: managerId }] };
  return {};
}

/** @returns {Promise<object>} the new farm, populated */
export const createFarm = async (data) => findFarmById((await Farm.create(data))._id);

export const findFarmById = (id) => populated(Farm.findById(id));

/**
 * One page of farms in a scope, newest first.
 * @param {{ scope: object, q?: RegExp, status?: string, municipality?: string, ownerType?: string, farmerId?: string, page: number, limit: number }} query
 */
export function listFarms({ scope, q, status = 'active', municipality, ownerType, farmerId, page, limit }) {
  const filter = {
    ...scopeFilter(scope),
    archivedAt: status === 'archived' ? { $ne: null } : null,
    ...(municipality && { municipality }),
    ...(ownerType && { ownerType }),
    ...(farmerId && { owner: farmerId }),
    ...(q && { $and: [{ $or: [{ propertyNumber: q }, { lotNumber: q }, { barangay: q }, { street: q }] }] }),
  };
  return pageList(Farm.find(filter).sort({ createdAt: -1, _id: -1 }).populate(POPULATE), { page, limit });
}

/** @returns {Promise<object|null>} the updated farm, populated */
export const updateFarm = (id, fields) => populated(Farm.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true }));

/** Records follow the farmer: their farms move with them when they join, transfer or leave an association. */
export const setOwnerAssociation = (ownerId, associationId) =>
  Farm.updateMany({ owner: ownerId, ownerType: 'farmer' }, { association: associationId });

/** Kaluppa farms count toward the association of the Group Manager that manages them. */
export const setManagedAssociation = (managerId, associationId) => Farm.updateMany({ managedBy: managerId }, { association: associationId });

/** Ids of the farms in a scope, archived ones included (their harvests stay visible). null scope = every farm. */
export const findFarmIdsInScope = (scope, q) =>
  Farm.find({ ...scopeFilter(scope), ...(q && { $or: [{ propertyNumber: q }, { lotNumber: q }] }) }).distinct('_id');

/** A farmer's active farms: how many and their total hectares. */
export async function ownerTotals(ownerId) {
  const [row] = await Farm.aggregate([{ $match: { owner: new mongoose.Types.ObjectId(String(ownerId)), archivedAt: null } }, { $group: { _id: null, farms: { $sum: 1 }, hectares: { $sum: '$sizeHa' } } }]);
  return { farms: row?.farms ?? 0, hectares: row?.hectares ?? 0 };
}

export const countFarmsByAssociation = (associationId) => Farm.countDocuments({ association: associationId, archivedAt: null });

/** Ids of the Kaluppa farms a Group Manager manages. */
export const findManagedFarmIds = (managerId) => Farm.find({ managedBy: managerId }).distinct('_id');

/** Active farms in scope per municipality and owner type (overview notes). null = every farm. */
export const farmCounts = (farmIds) =>
  Farm.aggregate([
    { $match: { archivedAt: null, ...(farmIds && { _id: { $in: farmIds } }) } },
    { $group: { _id: { municipality: '$municipality', ownerType: '$ownerType' }, count: { $sum: 1 } } },
    { $sort: { count: -1, '_id.municipality': 1 } },
  ]);
