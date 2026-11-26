import { ROLES } from '../constants/permissions.js';

// Record scope (whose record) — PHASE-2-SPEC §2. Services call these; never `role ===` for scope.
const same = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * Is the user the record's owner? Records use `owner`; bean listings use `farmer`.
 * @param {{ _id: unknown }} user
 * @param {{ owner?: unknown, farmer?: unknown }} record
 */
export const isOwner = (user, record) => same(user._id, record.owner ?? record.farmer);

/**
 * Is the user the Group Manager of this association? `user.associationId` is set by `authenticate`.
 * @param {{ roles: string[], associationId?: unknown }} user
 * @param {unknown} associationId
 */
export const isAssociationManager = (user, associationId) =>
  user.roles.includes(ROLES.GROUP_MANAGER) && same(user.associationId, associationId);

/** Kaluppa acts on every association (farmers, records, reports); others are scoped to their own. */
export const seesEveryAssociation = (user) => user.roles.includes(ROLES.KALUPPA);

/** @param {{ ownerType: string }} farm */
export const isKaluppaFarm = (farm) => farm.ownerType === 'kaluppa';

/**
 * Is the user the Group Manager a Kaluppa farm is assigned to?
 * @param {{ _id: unknown }} user
 * @param {{ ownerType: string, managedBy?: unknown }} farm
 */
export const isAssignedManager = (user, farm) => isKaluppaFarm(farm) && same(user._id, farm.managedBy);

/** Group Managers act for the farmers of their association (and the Kaluppa farm they manage). */
export const isGroupManager = (user) => user.roles.includes(ROLES.GROUP_MANAGER);

/** Kaluppa accounts share the `team:kaluppa` side of every Kaluppa chat (PHASE-2-SPEC §3.9). */
export const isKaluppaTeam = (user) => user.roles.includes(ROLES.KALUPPA);
