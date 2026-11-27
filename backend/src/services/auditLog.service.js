import { findAuditEntryById, listAuditForExport, listAuditPage, listEntityHistory } from '../repositories/audit.repository.js';
import { findUserIdsByName } from '../repositories/user.repository.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { AppError } from '../utils/AppError.js';
import { getAssociation } from './association.service.js';
import { getListing } from './bean.service.js';
import { buildExport } from './export.service.js';
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
const actorOf = (u) => (u ? { id: String(u._id), name: `${u.firstName} ${u.lastName}`, initials: initials(u), avatarUrl: u.avatar?.url ?? null } : null);

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
      actor: actorOf(e.actor),
      actorRole: e.actorRole,
      changes: e.changes,
    })),
    meta: { ...meta, canOpenAuditLog: await userCan(actor, 'audit.view') },
  };
}

/** Areas and actor roles the audit log filters by (every `area` that `audit.record` is called with). */
export const AUDIT_AREAS = ['associations', 'audit_log', 'beans', 'farmers', 'farms', 'group_managers', 'harvests', 'hub', 'inventory', 'orders', 'reports', 'reviews', 'settings', 'trees'];
export const AUDIT_ROLES = ['kaluppa', 'group_manager', 'farmer', 'buyer', 'system'];
const EXPORT_MAX = 10_000;

/** A short, stable reference for an entry ("AUD-1A2B3C4D"). */
const codeOf = (id) => `AUD-${String(id).slice(-8).toUpperCase()}`;

const toEntry = (e) => ({
  id: String(e._id),
  code: codeOf(e._id),
  at: e.at,
  actor: actorOf(e.actor),
  actorRole: e.actorRole,
  area: e.area,
  action: e.action,
  entityType: e.entityType,
  entityId: String(e.entityId),
  entityLabel: e.entityLabel,
  changes: e.changes,
});

/** Manila calendar days → instants: from the start of `from` to the end of `to`. */
const dayStart = (day) => new Date(`${day}T00:00:00+08:00`);
async function filtersOf({ area, role, from, to, entity, q }) {
  const words = q ? q.split(/\s+/).filter(Boolean).map(containsPattern) : [];
  return {
    area,
    role,
    entity,
    from: from ? dayStart(from) : undefined,
    to: to ? new Date(dayStart(to).getTime() + 86_400_000) : undefined,
    q: q ? containsPattern(q) : undefined,
    actorIds: words.length ? await findUserIdsByName(words) : [],
  };
}

/**
 * The audit log (Kaluppa, `audit.view`): newest first, page-numbered.
 * @param {{ area?: string, role?: string, from?: string, to?: string, entity?: string, q?: string, page: number, limit: number }} query
 */
export async function listAuditLog({ page, limit, ...query }) {
  const { items, meta } = await listAuditPage(await filtersOf(query), { page, limit });
  return { items: items.map(toEntry), meta };
}

/** One entry for the diff drawer; 404 when there's none. */
export async function getAuditEntry(id) {
  const entry = await findAuditEntryById(id);
  if (!entry) throw new AppError(404, 'Audit entry not found.');
  return toEntry(entry);
}

const valueText = (v) => (v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

const AREA_LABELS = { audit_log: 'Audit log', group_managers: 'Group Managers' };
const ROLE_LABELS = { kaluppa: 'Kaluppa', group_manager: 'Group Manager', farmer: 'Farmer', buyer: 'Buyer', system: 'System' };
const words = (key) => key.charAt(0).toUpperCase() + key.slice(1).replaceAll('_', ' ');
const manilaStamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });

/**
 * The filtered entries as CSV or PDF (at most 10,000, newest first; PHASE-2-SPEC §3.17).
 * @param {object} actor
 * @param {{ format: 'csv'|'pdf', area?: string, role?: string, from?: string, to?: string, entity?: string, q?: string }} query
 */
export async function exportAuditLog(actor, { format, ...query }) {
  const rows = (await listAuditForExport(await filtersOf(query), EXPORT_MAX)).map(toEntry).map((e) => [
    e.code,
    manilaStamp.format(e.at).replace(',', ''),
    e.actor?.name ?? 'System',
    ROLE_LABELS[e.actorRole] ?? e.actorRole,
    AREA_LABELS[e.area] ?? words(e.area),
    words(e.action),
    e.entityLabel || e.entityId,
    e.changes.map((c) => `${c.field}: ${valueText(c.from)} → ${valueText(c.to)}`).join('; '),
  ]);
  const filters = [
    ...(query.area ? [['Area', AREA_LABELS[query.area] ?? words(query.area)]] : []),
    ...(query.role ? [['Role', ROLE_LABELS[query.role]]] : []),
    ...(query.from ? [['From', query.from]] : []),
    ...(query.to ? [['To', query.to]] : []),
    ...(query.entity ? [['Record', query.entity]] : []),
    ...(query.q ? [['Search', query.q]] : []),
  ];
  return buildExport(actor, format, {
    name: 'audit-log',
    title: 'Audit log',
    filters,
    landscape: true,
    kpis: [{ label: 'Entries', value: rows.length.toLocaleString('en-PH') }],
    tables: [{ title: 'Entries', header: ['Entry', 'When', 'Who', 'Role', 'Area', 'Action', 'Record', 'Changes'], rows }],
  }, 'audit_log');
}
