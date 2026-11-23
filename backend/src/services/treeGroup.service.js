import { VARIETIES } from '../constants/catalog.js';
import * as repo from '../repositories/treeGroup.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { record } from './audit.service.js';
import { canManageRecords, canSee, farmForRecords, farmIdsFor, person, recordFarm } from './farm.service.js';

const AUDITED = ['farm', 'variety', 'count', 'stage', 'plantedAt', 'note'];
const notFound = () => new AppError(404, 'Tree group not found.');
const day = (date) => date.toISOString().slice(0, 10);

/** @returns {object} API shape; `canEdit` follows the farm (see farm.service `canManageRecords`). */
const toDto = (group, actor) => ({
  id: String(group._id),
  farm: recordFarm(group.farm),
  owner: person(group.owner),
  variety: group.variety,
  count: group.count,
  stage: group.stage,
  plantedAt: day(group.plantedAt),
  note: group.note,
  recordedBy: person(group.recordedBy),
  status: group.archivedAt ? 'archived' : 'active',
  archivedAt: group.archivedAt,
  createdAt: group.createdAt,
  canEdit: canManageRecords(actor, group.farm),
});

const entity = (group) => ({ type: 'tree_group', id: group._id, label: `${group.count} ${VARIETIES[group.variety]} trees · ${group.farm.propertyNumber}` });
const auditView = (group) => ({ ...Object.fromEntries(AUDITED.map((k) => [k, group[k] ?? null])), farm: group.farm.propertyNumber, plantedAt: day(group.plantedAt) });

/** A tree group on a farm the actor can see; 404 otherwise. */
async function loadGroup(actor, id) {
  const group = await repo.findTreeGroupById(id);
  if (!group || !canSee(actor, group.farm)) throw notFound();
  return group;
}

/** @param {object} actor @param {{ q?: string, status?: string, farmId?: string, variety?: string, stage?: string, page: number, limit: number }} query */
export async function listTreeGroups(actor, { q, ...query }) {
  const farmIds = await farmIdsFor(actor);
  const pattern = q ? containsPattern(q) : undefined;
  const [{ items, meta }, stageTotals] = await Promise.all([
    repo.listTreeGroups({ ...query, farmIds, q: pattern, matchingFarmIds: pattern ? await farmIdsFor(actor, pattern) : [] }),
    repo.stageTotals(farmIds),
  ]);
  return { items: items.map((g) => toDto(g, actor)), meta: { ...meta, stageTotals } };
}

/** Add trees to a farm the actor manages. `recordedBy` is the actor. */
export async function createTreeGroup(actor, { farmId, ...fields }) {
  const farm = await farmForRecords(actor, farmId);
  const group = await repo.createTreeGroup({ ...fields, farm: farm._id, owner: farm.owner._id, association: farm.association?._id ?? null, recordedBy: actor._id });
  await record({ actor, area: 'trees', action: 'create', entity: entity(group), after: auditView(group), fields: AUDITED });
  return toDto(group, actor);
}

/** Change a group; moving it to another farm needs that farm to be manageable too. */
export async function updateTreeGroup(actor, id, { farmId, ...fields }) {
  const before = await loadGroup(actor, id);
  if (!canManageRecords(actor, before.farm)) throw new AppError(403, 'You can’t change these trees.');
  if (before.archivedAt) throw new AppError(409, 'Restore this tree group before you edit it.');
  const farm = String(farmId) === String(before.farm._id) ? before.farm : await farmForRecords(actor, farmId);
  const after = await repo.updateTreeGroup(id, { ...fields, farm: farm._id, owner: farm.owner._id ?? farm.owner, association: farm.association?._id ?? farm.association ?? null });
  await record({ actor, area: 'trees', action: 'update', entity: entity(after), before: auditView(before), after: auditView(after), fields: AUDITED });
  return toDto(after, actor);
}

export async function archiveTreeGroup(actor, id) {
  const group = await loadGroup(actor, id);
  if (!canManageRecords(actor, group.farm)) throw new AppError(403, 'You can’t change these trees.');
  if (group.archivedAt) throw new AppError(409, 'This tree group is already archived.');
  const after = await repo.updateTreeGroup(id, { archivedAt: new Date() });
  await record({ actor, area: 'trees', action: 'archive', entity: entity(after), before: { status: 'active' }, after: { status: 'archived' }, fields: ['status'] });
  return toDto(after, actor);
}

/** Undo an archive. A group on an archived farm comes back with the farm. */
export async function restoreTreeGroup(actor, id) {
  const group = await loadGroup(actor, id);
  if (!canManageRecords(actor, group.farm)) throw new AppError(403, 'You can’t change these trees.');
  if (!group.archivedAt) throw new AppError(409, 'This tree group isn’t archived.');
  if (group.farm.archivedAt) throw new AppError(409, 'Restore the farm first. Its tree groups come back with it.');
  const after = await repo.updateTreeGroup(id, { archivedAt: null });
  await record({ actor, area: 'trees', action: 'restore', entity: entity(after), before: { status: 'archived' }, after: { status: 'active' }, fields: ['status'] });
  return toDto(after, actor);
}
