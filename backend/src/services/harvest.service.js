import { VARIETIES } from '../constants/catalog.js';
import * as repo from '../repositories/harvest.repository.js';
import { activeVarieties } from '../repositories/treeGroup.repository.js';
import { todayKey } from '../schemas/rules.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { record } from './audit.service.js';
import { canManageRecords, canSee, farmForRecords, farmIdsFor, person, recordFarm } from './farm.service.js';

const AUDITED = ['farm', 'variety', 'yieldKg', 'harvestedAt', 'note'];
const notFound = () => new AppError(404, 'Harvest not found.');
const day = (date) => date.toISOString().slice(0, 10);
const label = (variety) => VARIETIES[variety] ?? variety;
const orList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

const toDto = (harvest, actor) => ({
  id: String(harvest._id),
  farm: recordFarm(harvest.farm),
  owner: person(harvest.owner),
  variety: harvest.variety,
  yieldKg: harvest.yieldKg,
  harvestedAt: day(harvest.harvestedAt),
  note: harvest.note,
  recordedBy: person(harvest.recordedBy),
  status: harvest.archivedAt ? 'archived' : 'active',
  archivedAt: harvest.archivedAt,
  createdAt: harvest.createdAt,
  canEdit: canManageRecords(actor, harvest.farm),
});

const entity = (h) => ({ type: 'harvest', id: h._id, label: `${h.yieldKg} kg ${label(h.variety)} · ${h.farm.propertyNumber}` });
const auditView = (h) => ({ ...Object.fromEntries(AUDITED.map((k) => [k, h[k] ?? null])), farm: h.farm.propertyNumber, harvestedAt: day(h.harvestedAt) });

/**
 * Manila calendar ranges for the Period filter. Dates are stored as UTC midnight of the picked day.
 * @param {'last_12_months'|'this_year'|'last_year'|'all'} period
 */
export function periodRange(period) {
  const [y, m, d] = todayKey().split('-').map(Number);
  if (period === 'this_year') return { from: new Date(Date.UTC(y, 0, 1)) };
  if (period === 'last_year') return { from: new Date(Date.UTC(y - 1, 0, 1)), to: new Date(Date.UTC(y, 0, 1)) };
  if (period === 'all') return {};
  return { from: new Date(Date.UTC(y - 1, m - 1, d + 1)) };
}

/** A harvest's variety must be one the farm has active tree groups of (PHASE-2-SPEC §3.6). */
async function assertVariety(farm, variety) {
  const varieties = await activeVarieties(farm._id);
  if (varieties.includes(variety)) return;
  const message = varieties.length
    ? `This farm has no ${label(variety)} trees. Pick ${orList(varieties.map(label).sort())}.`
    : 'Add tree groups to this farm before you record a harvest.';
  throw new AppError(400, message, { code: 'VALIDATION_ERROR', errors: { variety: message } });
}

async function loadHarvest(actor, id) {
  const harvest = await repo.findHarvestById(id);
  if (!harvest || !canSee(actor, harvest.farm)) throw notFound();
  return harvest;
}

/** The Harvests page tiles: this year's total, the top variety, the last harvest. */
async function summaryFor(farmIds) {
  const [byVariety, last] = await Promise.all([repo.yieldByVariety(farmIds, periodRange('this_year').from), repo.latestHarvest(farmIds)]);
  const totalKg = byVariety.reduce((sum, v) => sum + v.kg, 0);
  return {
    thisYear: { yieldKg: totalKg, harvests: byVariety.reduce((sum, v) => sum + v.harvests, 0) },
    topVariety: byVariety[0] ? { variety: byVariety[0]._id, share: Math.round((byVariety[0].kg / totalKg) * 100) } : null,
    lastHarvest: last ? { yieldKg: last.yieldKg, harvestedAt: day(last.harvestedAt), farm: { propertyNumber: last.farm.propertyNumber } } : null,
  };
}

/** @param {object} actor @param {{ q?: string, status?: string, farmId?: string, variety?: string, period?: string, page: number, limit: number }} query */
export async function listHarvests(actor, { q, period = 'last_12_months', ...query }) {
  const farmIds = await farmIdsFor(actor);
  const pattern = q ? containsPattern(q) : undefined;
  const [{ items, meta }, summary] = await Promise.all([
    repo.listHarvests({ ...query, farmIds, range: periodRange(period), q: pattern, matchingFarmIds: pattern ? await farmIdsFor(actor, pattern) : [] }),
    summaryFor(farmIds),
  ]);
  return { items: items.map((h) => toDto(h, actor)), meta: { ...meta, summary } };
}

/** Record a harvest on a farm the actor manages. `recordedBy` is the actor. */
export async function createHarvest(actor, { farmId, ...fields }) {
  const farm = await farmForRecords(actor, farmId);
  await assertVariety(farm, fields.variety);
  const harvest = await repo.createHarvest({ ...fields, farm: farm._id, owner: farm.owner._id, association: farm.association?._id ?? null, recordedBy: actor._id });
  await record({ actor, area: 'harvests', action: 'create', entity: entity(harvest), after: auditView(harvest), fields: AUDITED });
  return toDto(harvest, actor);
}

export async function updateHarvest(actor, id, { farmId, ...fields }) {
  const before = await loadHarvest(actor, id);
  if (!canManageRecords(actor, before.farm)) throw new AppError(403, 'You can’t change this harvest.');
  if (before.archivedAt) throw new AppError(409, 'Restore this harvest before you edit it.');
  const farm = await farmForRecords(actor, farmId);
  await assertVariety(farm, fields.variety);
  const after = await repo.updateHarvest(id, { ...fields, farm: farm._id, owner: farm.owner._id, association: farm.association?._id ?? null });
  await record({ actor, area: 'harvests', action: 'update', entity: entity(after), before: auditView(before), after: auditView(after), fields: AUDITED });
  return toDto(after, actor);
}

export async function archiveHarvest(actor, id) {
  const harvest = await loadHarvest(actor, id);
  if (!canManageRecords(actor, harvest.farm)) throw new AppError(403, 'You can’t change this harvest.');
  if (harvest.archivedAt) throw new AppError(409, 'This harvest is already archived.');
  const after = await repo.updateHarvest(id, { archivedAt: new Date() });
  await record({ actor, area: 'harvests', action: 'archive', entity: entity(after), before: { status: 'active' }, after: { status: 'archived' }, fields: ['status'] });
  return toDto(after, actor);
}

export async function restoreHarvest(actor, id) {
  const harvest = await loadHarvest(actor, id);
  if (!canManageRecords(actor, harvest.farm)) throw new AppError(403, 'You can’t change this harvest.');
  if (!harvest.archivedAt) throw new AppError(409, 'This harvest isn’t archived.');
  const after = await repo.updateHarvest(id, { archivedAt: null });
  await record({ actor, area: 'harvests', action: 'restore', entity: entity(after), before: { status: 'archived' }, after: { status: 'active' }, fields: ['status'] });
  return toDto(after, actor);
}
