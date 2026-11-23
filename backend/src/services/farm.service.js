import { findAssociationByManager } from '../repositories/association.repository.js';
import { nextSequence } from '../repositories/counter.repository.js';
import * as repo from '../repositories/farm.repository.js';
import * as harvests from '../repositories/harvest.repository.js';
import * as trees from '../repositories/treeGroup.repository.js';
import { findProfileScope } from '../repositories/farmerProfile.repository.js';
import { findGroupManagerById } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { manilaDateKey } from '../utils/manilaDate.js';
import { record } from './audit.service.js';
import { isAssignedManager, isAssociationManager, isGroupManager, isKaluppaFarm, isOwner, seesEveryAssociation } from './policy.service.js';

const AUDITED = ['lotNumber', 'sizeHa', 'municipality', 'barangay', 'street', 'managedBy'];
const notFound = () => new AppError(404, 'Farm not found.');
const lotTaken = (message) => new AppError(409, message, { errors: { lotNumber: 'You already have a farm with this lot number' } });
const fullName = (user) => (user ? `${user.firstName} ${user.lastName}` : null);
const person = (user) => (user ? { id: String(user._id), name: fullName(user), username: user.username } : null);
const idOf = (ref) => ref?._id ?? ref ?? null;

/** The farm's references as ids, for the policy helpers (the repository populates them). */
const refs = (farm) => ({ owner: idOf(farm.owner), ownerType: farm.ownerType, association: idOf(farm.association), managedBy: idOf(farm.managedBy) });

/** Who may see a farm: its owner, the Group Manager of its farmer's association or of a managed Kaluppa farm, Kaluppa. */
export function canSee(actor, farm) {
  const f = refs(farm);
  if (seesEveryAssociation(actor) || isOwner(actor, f) || isAssignedManager(actor, f)) return true;
  return !isKaluppaFarm(f) && isAssociationManager(actor, f.association);
}

/** Who may change a farm's details: Kaluppa only its own farms; the owner and their Group Manager farmer farms. */
export function canEditFarm(actor, farm) {
  const f = refs(farm);
  if (seesEveryAssociation(actor)) return isKaluppaFarm(f);
  return !isKaluppaFarm(f) && (isOwner(actor, f) || isAssociationManager(actor, f.association));
}

/** Who may add or change a farm's trees and harvests: whoever edits the farm, plus the Group Manager of a Kaluppa farm. */
export const canManageRecords = (actor, farm) => canEditFarm(actor, farm) || isAssignedManager(actor, refs(farm));

/** The scope of `GET /farms` for this actor (see farm.repository `scopeFilter`). */
const scopeOf = (actor) => {
  if (seesEveryAssociation(actor)) return {};
  if (isGroupManager(actor)) return { associationId: actor.associationId ?? null, managerId: actor._id };
  return { ownerId: actor._id };
};

/**
 * API shape. `canEdit` / `canAssignFarmers` / `canManageRecords` tell the dashboard which actions to show;
 * `stats` adds active trees and the last harvest (see `withStats`).
 */
export const toFarmDto = (farm, actor, stats = {}) => {
  const [lng, lat] = farm.location.coordinates;
  return {
    id: String(farm._id),
    propertyNumber: farm.propertyNumber,
    lotNumber: farm.lotNumber,
    ownerType: farm.ownerType,
    owner: person(farm.owner),
    association: farm.association ? { id: String(farm.association._id), name: farm.association.name } : null,
    managedBy: isKaluppaFarm(farm) ? person(farm.managedBy) : null,
    assignedFarmers: (farm.assignedFarmers ?? []).map((u) => ({ id: String(u._id), name: fullName(u) })),
    sizeHa: farm.sizeHa,
    municipality: farm.municipality,
    barangay: farm.barangay,
    street: farm.street,
    location: { lat, lng },
    status: farm.archivedAt ? 'archived' : 'active',
    archivedAt: farm.archivedAt,
    createdAt: farm.createdAt,
    canEdit: canEditFarm(actor, farm),
    canAssignFarmers: isAssignedManager(actor, refs(farm)),
    canManageRecords: canManageRecords(actor, farm),
    treeCount: stats.trees?.trees ?? 0,
    groupCount: stats.trees?.groups ?? 0,
    varieties: stats.trees?.varieties ?? [],
    lastHarvest: stats.last ? { yieldKg: stats.last.yieldKg, harvestedAt: stats.last.harvestedAt.toISOString().slice(0, 10) } : null,
  };
};

/** Farms → DTOs with their active trees, varieties and last harvest. */
async function withStats(farms, actor) {
  const farmIds = farms.map((f) => f._id);
  const [treeStats, last] = await Promise.all([trees.statsByFarms(farmIds), harvests.lastByFarms(farmIds)]);
  return farms.map((f) => toFarmDto(f, actor, { trees: treeStats.get(String(f._id)), last: last.get(String(f._id)) }));
}
const oneWithStats = async (farm, actor) => (await withStats([farm], actor))[0];

const entity = (farm) => ({ type: 'farm', id: farm._id, label: `${farm.propertyNumber} · ${farm.lotNumber}` });
const auditView = (farm) => ({ ...Object.fromEntries(AUDITED.map((k) => [k, farm[k] ?? null])), managedBy: fullName(farm.managedBy) });
const toDoc = ({ location, ...fields }) => ({ ...fields, location: { type: 'Point', coordinates: [location.lng, location.lat] } });

/** `TCT-<year>-<NNNN>`, one sequence per Manila calendar year. */
async function nextPropertyNumber() {
  const year = manilaDateKey().slice(0, 4);
  return `TCT-${year}-${String(await nextSequence(`farm:${year}`)).padStart(4, '0')}`;
}

/** A duplicate `{owner, lotNumber}` (partial unique index) becomes a 409 on lotNumber; anything else rethrows. */
async function guardLot(write, message) {
  try {
    return await write();
  } catch (err) {
    if (err?.code === 11000 && err.keyPattern?.lotNumber) throw lotTaken(message);
    throw err;
  }
}

/** A farmer approved into the Group Manager's association; 404 otherwise, so other associations don't leak. */
async function farmerOfManager(actor, farmerId) {
  const profile = await findProfileScope(farmerId);
  if (!actor.associationId || profile?.status !== 'approved' || !isAssociationManager(actor, profile.association)) {
    throw new AppError(404, 'Farmer not found.');
  }
  return profile;
}

/** A Group Manager for a Kaluppa farm, with the association its farm counts toward. */
async function managerFor(managedById) {
  if (!managedById) return { managedBy: null, association: null };
  const manager = await findGroupManagerById(managedById);
  if (!manager || manager.status !== 'active') {
    throw new AppError(400, 'Choose an active Group Manager.', { code: 'VALIDATION_ERROR', errors: { managedById: 'Choose an active Group Manager' } });
  }
  return { managedBy: manager._id, association: (await findAssociationByManager(manager._id))?._id ?? null };
}

/** A farm the actor may see; 404 otherwise. */
export async function loadFarm(actor, id) {
  const farm = await repo.findFarmById(id);
  if (!farm || !canSee(actor, farm)) throw notFound();
  return farm;
}
const forbidden = (message = 'You can’t change this farm.') => new AppError(403, message);

/** @param {object} actor @param {{ q?: string, status?: string, municipality?: string, ownerType?: string, farmerId?: string, page: number, limit: number }} query */
export async function listFarms(actor, { q, ...query }) {
  const { items, meta } = await repo.listFarms({ ...query, scope: scopeOf(actor), q: q ? containsPattern(q) : undefined });
  return { items: await withStats(items, actor), meta };
}

export const getFarm = async (actor, id) => oneWithStats(await loadFarm(actor, id), actor);

/**
 * The farms whose trees and harvests the actor may list: null = every farm (Kaluppa), else their ids, archived
 * farms included. With `q`, only farms whose property or lot number matches.
 */
export const farmIdsFor = (actor, q) => (seesEveryAssociation(actor) && !q ? null : repo.findFarmIdsInScope(scopeOf(actor), q));

/**
 * Add a farm. Kaluppa adds Kaluppa farms; a Group Manager adds one for a farmer it manages (`farmerId` required);
 * a farmer adds their own (approved or not).
 */
export async function createFarm(actor, { farmerId, managedById, ...fields }) {
  let owner = actor._id;
  let ownerType = 'farmer';
  let placement = { managedBy: null, association: actor.associationId ?? null };
  if (seesEveryAssociation(actor)) {
    ownerType = 'kaluppa';
    placement = await managerFor(managedById);
  } else if (isGroupManager(actor)) {
    if (!farmerId) throw new AppError(400, 'Choose the farmer who owns this farm.', { code: 'VALIDATION_ERROR', errors: { farmerId: 'Choose the farmer who owns this farm' } });
    const profile = await farmerOfManager(actor, farmerId);
    owner = farmerId;
    placement = { managedBy: null, association: profile.association };
  }
  const farm = await guardLot(
    async () => repo.createFarm(toDoc({ ...fields, ...placement, owner, ownerType, createdBy: actor._id, propertyNumber: await nextPropertyNumber() })),
    'That owner already has a farm with this lot number.',
  );
  await record({ actor, area: 'farms', action: 'create', entity: entity(farm), after: auditView(farm), fields: AUDITED });
  return oneWithStats(farm, actor);
}

/** Change a farm's details. Kaluppa may also change who manages a Kaluppa farm (its assigned farmers are cleared). */
export async function updateFarm(actor, id, { farmerId: _ignored, managedById, ...fields }) {
  const before = await loadFarm(actor, id);
  if (!canEditFarm(actor, before)) throw forbidden();
  if (before.archivedAt) throw new AppError(409, 'Restore this farm before you edit it.');
  const changes = toDoc(fields);
  if (isKaluppaFarm(before) && managedById !== undefined && String(managedById) !== String(idOf(before.managedBy))) {
    Object.assign(changes, await managerFor(managedById), { assignedFarmers: [] });
  }
  const after = await guardLot(() => repo.updateFarm(id, changes), 'That owner already has a farm with this lot number.');
  if ('association' in changes) await moveFarmRecords([after._id], changes.association);
  await record({ actor, area: 'farms', action: 'update', entity: entity(after), before: auditView(before), after: auditView(after), fields: AUDITED });
  return oneWithStats(after, actor);
}

/** Soft delete (PHASE-2-SPEC §3.6): its active tree groups are archived with it; harvests stay. */
export async function archiveFarm(actor, id) {
  const farm = await loadFarm(actor, id);
  if (!canEditFarm(actor, farm)) throw forbidden();
  if (farm.archivedAt) throw new AppError(409, 'This farm is already archived.');
  const at = new Date();
  const after = await repo.updateFarm(id, { archivedAt: at });
  await trees.archiveByFarm(after._id, at);
  await record({ actor, area: 'farms', action: 'archive', entity: entity(after), before: { status: 'active' }, after: { status: 'archived' }, fields: ['status'] });
  return oneWithStats(after, actor);
}

/** Undo an archive. 409 when the owner has since used the lot number on an active farm. */
export async function restoreFarm(actor, id) {
  const farm = await loadFarm(actor, id);
  if (!canEditFarm(actor, farm)) throw forbidden();
  if (!farm.archivedAt) throw new AppError(409, 'This farm isn’t archived.');
  const after = await guardLot(() => repo.updateFarm(id, { archivedAt: null }), 'An active farm already uses this lot number. Change that one first.');
  await trees.restoreByFarm(after._id, farm.archivedAt); // only the groups archived with the farm
  await record({ actor, area: 'farms', action: 'restore', entity: entity(after), before: { status: 'archived' }, after: { status: 'active' }, fields: ['status'] });
  return oneWithStats(after, actor);
}

/** The farmers working on a Kaluppa farm: only its Group Manager sets them, from its own approved farmers. */
export async function setAssignedFarmers(actor, id, { farmerIds }) {
  const farm = await loadFarm(actor, id);
  if (!isAssignedManager(actor, refs(farm))) throw forbidden('Only the Group Manager this farm is assigned to can change who works on it.');
  if (farm.archivedAt) throw new AppError(409, 'Restore this farm first.');
  const unique = [...new Set(farmerIds.map(String))];
  const profiles = await Promise.all(unique.map((farmerId) => findProfileScope(farmerId)));
  if (profiles.some((p) => p?.status !== 'approved' || !isAssociationManager(actor, p.association))) {
    throw new AppError(400, 'Choose approved farmers from your association.', { code: 'VALIDATION_ERROR', errors: { farmerIds: 'Choose approved farmers from your association' } });
  }
  const after = await repo.updateFarm(id, { assignedFarmers: unique });
  const names = (f) => (f.assignedFarmers ?? []).map(fullName);
  await record({ actor, area: 'farms', action: 'assign_farmers', entity: entity(after), before: { assignedFarmers: names(farm) }, after: { assignedFarmers: names(after) }, fields: ['assignedFarmers'] });
  return oneWithStats(after, actor);
}

/** A farmer joined, moved or left an association: their farms, trees and harvests move with them (PHASE-2-SPEC §4). */
export async function moveOwnerRecords(ownerId, associationId) {
  await Promise.all([repo.setOwnerAssociation(ownerId, associationId ?? null), trees.setOwnerAssociation(ownerId, associationId ?? null), harvests.setOwnerAssociation(ownerId, associationId ?? null)]);
}

/** The trees and harvests of these farms count toward `associationId`. */
const moveFarmRecords = (farmIds, associationId) =>
  Promise.all([trees.setFarmsAssociation(farmIds, associationId ?? null), harvests.setFarmsAssociation(farmIds, associationId ?? null)]);

/** A Group Manager moved associations: the Kaluppa farms it manages, and their records, count toward the new one. */
export async function moveManagedFarms(managerId, associationId) {
  await repo.setManagedAssociation(managerId, associationId ?? null);
  await moveFarmRecords(await repo.findManagedFarmIds(managerId), associationId);
}

/**
 * The farm a tree group or harvest is written to: visible (404), the actor may manage its records (403), active (409).
 * @returns {Promise<object>} the farm, populated
 */
export async function farmForRecords(actor, farmId) {
  const farm = await loadFarm(actor, farmId);
  if (!canManageRecords(actor, farm)) throw forbidden('You can’t add records to this farm.');
  if (farm.archivedAt) throw new AppError(409, 'Restore this farm first.');
  return farm;
}

/** A tree group's or harvest's farm, as the record DTOs show it. */
export const recordFarm = (farm) => ({
  id: String(farm._id),
  propertyNumber: farm.propertyNumber,
  lotNumber: farm.lotNumber,
  ownerType: farm.ownerType,
  barangay: farm.barangay,
  municipality: farm.municipality,
  managedBy: isKaluppaFarm(farm) ? person(farm.managedBy) : null,
  status: farm.archivedAt ? 'archived' : 'active',
});
export { person };
