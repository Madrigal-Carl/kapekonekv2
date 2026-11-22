import { FarmerProfile } from '../models/farmerProfile.model.js';

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
