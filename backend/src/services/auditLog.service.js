import { listEntityHistory } from '../repositories/audit.repository.js';
import { AppError } from '../utils/AppError.js';
import { getAssociation } from './association.service.js';
import { getListing } from './bean.service.js';
import { loadFarm } from './farm.service.js';
import { getFarmer } from './farmer.service.js';
import { getGroupManager } from './groupManager.service.js';
import { loadHarvest } from './harvest.service.js';
import { getInventoryProduct } from './inventory.service.js';
import { findOrderFor } from './order.service.js';
import { userCan } from './permission.service.js';
import { getAdminReview } from './reviewModeration.service.js';
import { loadGroup } from './treeGroup.service.js';

/**
 * Who may read a record's history: whoever may view the record (PHASE-2-SPEC §3.15). Each entry is the permission
 * that record's own GET route needs (any of them), and the loader that applies the record's policy (404 when out of scope).
 */
const ACCESS = {
  farmer: { can: ['farmers.manage'], load: getFarmer },
  user: { can: ['group_managers.manage'], load: (_actor, id) => getGroupManager(id) },
  association: { can: ['associations.manage'], load: (_actor, id) => getAssociation(id) },
  farm: { can: ['farms.manage'], load: loadFarm },
  tree_group: { can: ['trees.manage'], load: loadGroup },
  harvest: { can: ['harvests.manage'], load: loadHarvest },
  bean_listing: { can: ['beans.sell', 'beans.review'], load: getListing },
  order: { can: ['orders.view_own', 'orders.manage'], load: findOrderFor },
  product: { can: ['inventory.manage'], load: (_actor, id) => getInventoryProduct(id) },
  review: { can: ['reviews.moderate'], load: (_actor, id) => getAdminReview(id) },
};
export const HISTORY_TYPES = Object.keys(ACCESS);

const initials = (u) => `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.toUpperCase();

/**
 * A record's history for its drawer, newest first: actor, action, time and changed fields.
 * Only Kaluppa (audit.view) gets the link to the full audit log.
 * @param {object} actor
 * @param {{ entityType: keyof typeof ACCESS, entityId: string, cursor?: string, limit: number }} query
 */
export async function getEntityHistory(actor, { entityType, entityId, cursor, limit }) {
  const access = ACCESS[entityType];
  const allowed = await Promise.all(access.can.map((slug) => userCan(actor, slug)));
  if (!allowed.some(Boolean)) throw new AppError(404, 'Not found.');
  await access.load(actor, entityId);
  const { items, meta } = await listEntityHistory({ entityType, entityId, cursor, limit });
  return {
    items: items.map((e) => ({
      id: String(e._id),
      at: e.at,
      area: e.area,
      action: e.action,
      actor: e.actor ? { id: String(e.actor._id), name: `${e.actor.firstName} ${e.actor.lastName}`, initials: initials(e.actor), avatarUrl: e.actor.avatar?.url ?? null } : null,
      actorRole: e.actorRole,
      changes: e.changes,
    })),
    meta: { ...meta, canOpenAuditLog: await userCan(actor, 'audit.view') },
  };
}
