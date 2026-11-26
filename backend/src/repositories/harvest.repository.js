import { Harvest } from '../models/harvest.model.js';
import { pageList } from '../utils/pageList.js';
import { oids, RECORD_POPULATE } from './treeGroup.repository.js';

const inFarms = (farmIds) => (farmIds ? { farm: { $in: farmIds } } : {});

export const createHarvest = async (data) => findHarvestById((await Harvest.create(data))._id);
export const findHarvestById = (id) => Harvest.findById(id).populate(RECORD_POPULATE).lean();
export const updateHarvest = (id, fields) =>
  Harvest.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true }).populate(RECORD_POPULATE).lean();

/**
 * One page of harvests, latest harvest first.
 * @param {{ farmIds: unknown[]|null, q?: RegExp, matchingFarmIds?: unknown[], status?: string, farmId?: string, variety?: string,
 *   range?: { from?: Date, to?: Date }, page: number, limit: number }} query
 */
export function listHarvests({ farmIds, q, matchingFarmIds = [], status = 'active', farmId, variety, range = {}, page, limit }) {
  const filter = {
    ...inFarms(farmIds),
    archivedAt: status === 'archived' ? { $ne: null } : null,
    ...(farmId && { $and: [{ farm: farmId }] }),
    ...(variety && { variety }),
    ...((range.from || range.to) && { harvestedAt: { ...(range.from && { $gte: range.from }), ...(range.to && { $lt: range.to }) } }),
    ...(q && { $or: [{ note: q }, { variety: q }, { farm: { $in: matchingFarmIds } }] }),
  };
  return pageList(Harvest.find(filter).sort({ harvestedAt: -1, _id: -1 }).populate(RECORD_POPULATE), { page, limit });
}

/** Kilograms per variety among active harvests in scope since `from`, largest first. */
export const yieldByVariety = (farmIds, from) =>
  Harvest.aggregate([
    { $match: { archivedAt: null, harvestedAt: { $gte: from }, ...(farmIds && { farm: { $in: oids(farmIds) } }) } },
    { $group: { _id: '$variety', kg: { $sum: '$yieldKg' }, harvests: { $sum: 1 } } },
    { $sort: { kg: -1, _id: 1 } },
  ]);

/** The latest active harvest in scope. */
export const latestHarvest = (farmIds) =>
  Harvest.findOne({ archivedAt: null, ...inFarms(farmIds) }).sort({ harvestedAt: -1, _id: -1 }).populate(RECORD_POPULATE).lean();

/** The latest active harvest of each farm. @returns {Promise<Map<string, { yieldKg: number, harvestedAt: Date }>>} */
export async function lastByFarms(farmIds) {
  const rows = await Harvest.aggregate([
    { $match: { farm: { $in: oids(farmIds) }, archivedAt: null } },
    { $sort: { harvestedAt: -1, _id: -1 } },
    { $group: { _id: '$farm', yieldKg: { $first: '$yieldKg' }, harvestedAt: { $first: '$harvestedAt' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { yieldKg: r.yieldKg, harvestedAt: r.harvestedAt }]));
}

export const setOwnerAssociation = (ownerId, associationId) => Harvest.updateMany({ owner: ownerId }, { association: associationId });
export const setFarmsAssociation = (farmIds, associationId) => Harvest.updateMany({ farm: { $in: farmIds } }, { association: associationId });

/** Seeder only: a year of harvests in one write (the API path is `createHarvest`). */
export const insertHarvests = (docs) => Harvest.insertMany(docs);

/** Active harvests in scope in [from, to): when, variety and kilograms (overview charts). */
export const harvestRows = (farmIds, from, to) =>
  Harvest.find({ archivedAt: null, harvestedAt: { $gte: from, $lt: to }, ...inFarms(farmIds) }).select('harvestedAt variety yieldKg').lean();
