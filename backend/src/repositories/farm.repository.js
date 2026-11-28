import mongoose from 'mongoose';
import { Farm } from '../models/farm.model.js';
import { pageList } from '../utils/pageList.js';
import { associationMatch } from '../utils/reportQuery.js';

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
 * One page of farms in a scope, by property number (Change 08).
 * @param {{ scope: object, q?: RegExp, status?: string, municipality?: string, ownerType?: string, farmerId?: string, page: number, limit: number }} query
 */
export function listFarms({ scope, q, status = 'active', municipality, ownerType, farmerId, page, limit }) {
  const filter = {
    ...scopeFilter(scope),
    archivedAt: status === 'archived' ? { $ne: null } : null,
    ...(municipality && { municipality }),
    ...(ownerType && { ownerType }),
    ...(farmerId && { owner: farmerId }),
    ...(q && { $and: [{ $or: [{ propertyNumber: q }, { barangay: q }, { street: q }] }] }),
  };
  return pageList(Farm.find(filter).sort({ propertyNumber: 1, _id: 1 }).populate(POPULATE), { page, limit });
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
  Farm.find({ ...scopeFilter(scope), ...(q && { propertyNumber: q }) }).distinct('_id');

/** A farmer's active farms: how many and their total hectares. */
export async function ownerTotals(ownerId) {
  const [row] = await Farm.aggregate([{ $match: { owner: new mongoose.Types.ObjectId(String(ownerId)), archivedAt: null } }, { $group: { _id: null, farms: { $sum: 1 }, hectares: { $sum: '$sizeHa' } } }]);
  return { farms: row?.farms ?? 0, hectares: row?.hectares ?? 0 };
}

/** Farmers page "Farms owned" (Change 08): each owner's active farms, how many and the first property number. */
export async function ownedFarmsByOwners(ownerIds) {
  const rows = await Farm.aggregate([
    { $match: { owner: { $in: ownerIds }, ownerType: 'farmer', archivedAt: null } },
    { $sort: { propertyNumber: 1 } },
    { $group: { _id: '$owner', count: { $sum: 1 }, first: { $first: '$propertyNumber' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { count: r.count, first: r.first }]));
}

export const countFarmsByAssociation = (associationId) => Farm.countDocuments({ association: associationId, archivedAt: null });

/**
 * Active farms in a scope for the Farm Map, by property number.
 * @param {object} scope see `scopeFilter` @param {{ association?: string, municipality?: string, farmIds?: unknown[] }} filters
 */
export const listMapFarms = (scope, { association, municipality, farmIds }) =>
  populated(
    Farm.find({ ...scopeFilter(scope), archivedAt: null, ...(association && { association }), ...(municipality && { municipality }), ...(farmIds && { _id: { $in: farmIds } }) })
      .sort({ propertyNumber: 1 }),
  );

/** Ids of the Kaluppa farms a Group Manager manages. */
export const findManagedFarmIds = (managerId) => Farm.find({ managedBy: managerId }).distinct('_id');

/** Active farms in scope per municipality and owner type (overview notes). null = every farm. */
export const farmCounts = (farmIds) =>
  Farm.aggregate([
    { $match: { archivedAt: null, ...(farmIds && { _id: { $in: farmIds } }) } },
    { $group: { _id: { municipality: '$municipality', ownerType: '$ownerType' }, count: { $sum: 1 } } },
    { $sort: { count: -1, '_id.municipality': 1 } },
  ]);

/** Ids of every Kaluppa farm (Reports put their records in a "Kaluppa farms" row). */
export const findKaluppaFarmIds = () => Farm.find({ ownerType: 'kaluppa' }).distinct('_id');

/**
 * Reports: active farms in scope per group, with hectares; Kaluppa farms group as "kaluppa".
 * @param {string|null|undefined} association @param {'association'|'owner'} field
 */
export const farmReport = (association, field, exceptFarms) =>
  Farm.aggregate([
    { $match: { ...associationMatch(association, exceptFarms, '_id'), archivedAt: null } },
    { $group: { _id: { $cond: [{ $eq: ['$ownerType', 'kaluppa'] }, 'kaluppa', `$${field}`] }, farms: { $sum: 1 }, ha: { $sum: '$sizeHa' } } },
  ]);
