import mongoose from 'mongoose';
import { TreeGroup } from '../models/treeGroup.model.js';
import { pageList } from '../utils/pageList.js';
import { associationMatch } from '../utils/reportQuery.js';

const PEOPLE = 'firstName lastName username';
export const RECORD_POPULATE = [
  { path: 'farm', select: 'propertyNumber ownerType owner association managedBy barangay municipality archivedAt', populate: { path: 'managedBy', select: PEOPLE } },
  { path: 'owner', select: PEOPLE },
  { path: 'recordedBy', select: PEOPLE },
];
export const oids = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));

/** `farmIds`: null = every farm (Kaluppa), else only these. */
const inFarms = (farmIds) => (farmIds ? { farm: { $in: farmIds } } : {});

export const createTreeGroup = async (data) => findTreeGroupById((await TreeGroup.create(data))._id);
export const findTreeGroupById = (id) => TreeGroup.findById(id).populate(RECORD_POPULATE).lean();
export const updateTreeGroup = (id, fields) =>
  TreeGroup.findByIdAndUpdate(id, fields, { returnDocument: 'after', runValidators: true }).populate(RECORD_POPULATE).lean();

/**
 * One page of tree groups, newest first.
 * @param {{ farmIds: unknown[]|null, q?: RegExp, matchingFarmIds?: unknown[], status?: string, farmId?: string, variety?: string, stage?: string, page: number, limit: number }} query
 */
export function listTreeGroups({ farmIds, q, matchingFarmIds = [], status = 'active', farmId, variety, stage, page, limit }) {
  const filter = {
    ...inFarms(farmIds),
    archivedAt: status === 'archived' ? { $ne: null } : null,
    ...(farmId && { $and: [{ farm: farmId }] }),
    ...(variety && { variety }),
    ...(stage && { stage }),
    ...(q && { $or: [{ note: q }, { variety: q }, { farm: { $in: matchingFarmIds } }] }),
  };
  return pageList(TreeGroup.find(filter).sort({ createdAt: -1, _id: -1 }).populate(RECORD_POPULATE), { page, limit });
}

/** Trees per stage among active groups in scope (the Trees page tiles). */
export async function stageTotals(farmIds) {
  const rows = await TreeGroup.aggregate([
    { $match: { archivedAt: null, ...(farmIds && { farm: { $in: oids(farmIds) } }) } },
    { $group: { _id: '$stage', trees: { $sum: '$count' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.trees]));
}

/** Active trees, groups and varieties per farm. @returns {Promise<Map<string, { trees: number, groups: number, varieties: string[] }>>} */
export async function statsByFarms(farmIds) {
  const rows = await TreeGroup.aggregate([
    { $match: { farm: { $in: oids(farmIds) }, archivedAt: null } },
    { $group: { _id: '$farm', trees: { $sum: '$count' }, groups: { $sum: 1 }, varieties: { $addToSet: '$variety' } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), { trees: r.trees, groups: r.groups, varieties: r.varieties.sort() }]));
}

/** Ids of farms with active trees of a variety (Farm Map filter). */
export const farmIdsWithVariety = (variety) => TreeGroup.distinct('farm', { variety, archivedAt: null });

/** Active trees per farm, variety and stage (Farm Map popover). @returns {Promise<Array<{ _id: { farm, variety, stage }, trees: number }>>} */
export const treeMixByFarms = (farmIds) =>
  TreeGroup.aggregate([
    { $match: { farm: { $in: oids(farmIds) }, archivedAt: null } },
    { $group: { _id: { farm: '$farm', variety: '$variety', stage: '$stage' }, trees: { $sum: '$count' } } },
  ]);

/** Varieties a farm has active tree groups of (a harvest must be one of them). */
export const activeVarieties = async (farmId) => (await TreeGroup.distinct('variety', { farm: farmId, archivedAt: null })).sort();

/** Archiving a farm archives its active groups with the same timestamp, so a restore brings back exactly those. */
export const archiveByFarm = (farmId, at) => TreeGroup.updateMany({ farm: farmId, archivedAt: null }, { archivedAt: at });
export const restoreByFarm = (farmId, at) => TreeGroup.updateMany({ farm: farmId, archivedAt: at }, { archivedAt: null });

export const setOwnerAssociation = (ownerId, associationId) => TreeGroup.updateMany({ owner: ownerId }, { association: associationId });
export const setFarmsAssociation = (farmIds, associationId) => TreeGroup.updateMany({ farm: { $in: farmIds } }, { association: associationId });

/** Active tree groups in scope. null = every farm. */
export const countActiveGroups = (farmIds) => TreeGroup.countDocuments({ archivedAt: null, ...(farmIds && { farm: { $in: farmIds } }) });

/** Reports: active trees in scope per stage and per group (`$facet`). @param {string|null|undefined} association @param {object} group */
export async function treeReport(association, group, exceptFarms) {
  const [facets] = await TreeGroup.aggregate([
    { $match: { ...associationMatch(association, exceptFarms), archivedAt: null } },
    { $facet: { stages: [{ $group: { _id: '$stage', trees: { $sum: '$count' } } }], groups: [{ $group: { _id: group, trees: { $sum: '$count' } } }] } },
  ]);
  return facets;
}
