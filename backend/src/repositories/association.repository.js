import { Association } from '../models/association.model.js';
import { pageList } from '../utils/pageList.js';

const MANAGER = { path: 'groupManager', select: 'firstName lastName username' };

/** @param {object} data */
export const createAssociation = async (data) => (await Association.create(data)).toObject();

export const findAssociationById = (id) => Association.findById(id).populate(MANAGER).lean();

/** Another association with this slug (names are unique regardless of case). */
export const findAssociationBySlug = (slug, exceptId) =>
  Association.exists({ slug, ...(exceptId && { _id: { $ne: exceptId } }) });

export const updateAssociationFields = (id, fields) =>
  Association.findByIdAndUpdate(id, fields, { returnDocument: 'after' }).populate(MANAGER).lean();

/**
 * Page of associations. `status`: active|archived; `q` matches name or town.
 * @param {{ q?: RegExp, status?: string, municipality?: string, page: number, limit: number }} query
 */
export function listAssociations({ q, status, municipality, page, limit }) {
  const filter = {
    ...(status && { archivedAt: status === 'archived' ? { $ne: null } : null }),
    ...(municipality && { municipality }),
    ...(q && { $or: [{ name: q }, { municipality: q }] }),
  };
  return pageList(Association.find(filter).sort({ name: 1, _id: 1 }).populate(MANAGER), { page, limit });
}

export const listActiveOptions = () =>
  Association.find({ archivedAt: null }, { name: 1, municipality: 1, location: 1, groupManager: 1 }).sort({ name: 1 }).populate('groupManager', 'firstName lastName').lean();

/** The association a Group Manager runs, or null. */
export const findAssociationByManager = (managerId) => Association.findOne({ groupManager: managerId }).lean();

export const findManagerIdsByAssociationName = async (q) =>
  (await Association.find({ name: q, groupManager: { $ne: null } }, 'groupManager').lean()).map((a) => a.groupManager);

/** Managers that run an association. */
export const findAssignedManagerIds = async () =>
  (await Association.find({ groupManager: { $ne: null } }, 'groupManager').lean()).map((a) => a.groupManager);

/** Associations of these managers, by manager id. */
export const findAssociationsByManagers = (managerIds) => Association.find({ groupManager: { $in: managerIds } }).lean();

/**
 * Give an association with no manager this manager. False when it already has one or is archived (race-safe).
 */
export const claimManager = async (associationId, managerId) =>
  (await Association.updateOne({ _id: associationId, groupManager: null, archivedAt: null }, { groupManager: managerId })).modifiedCount === 1;

export const clearManager = (associationId) => Association.updateOne({ _id: associationId }, { groupManager: null });

export const countActiveAssociations = () => Association.countDocuments({ archivedAt: null });
