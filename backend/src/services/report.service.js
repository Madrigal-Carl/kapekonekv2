import { VARIETIES } from '../constants/catalog.js';
import { TREE_STAGES } from '../constants/records.js';
import { listActiveOptions } from '../repositories/association.repository.js';
import { beanReport } from '../repositories/bean.repository.js';
import { farmReport, findKaluppaFarmIds } from '../repositories/farm.repository.js';
import { countFarmersEverywhere, countWaiting, listApprovedFarmers } from '../repositories/farmerProfile.repository.js';
import { harvestReport } from '../repositories/harvest.repository.js';
import { soldRows } from '../repositories/order.repository.js';
import { treeReport } from '../repositories/treeGroup.repository.js';
import { AppError } from '../utils/AppError.js';
import { toCsv } from '../utils/csv.js';
import { compare, reportRange } from '../utils/period.js';
import { groupOrKaluppa } from '../utils/reportQuery.js';
import { userCan } from './permission.service.js';
import { seesEveryAssociation } from './policy.service.js';

export const REPORT_SECTIONS = ['summary', 'harvest', 'beans', 'sales', 'trees', 'breakdown'];
export const EXPORT_SECTIONS = ['harvest', 'beans', 'sales', 'trees', 'breakdown', 'all'];

const STAGE_LABELS = { newly_planted: 'Newly planted', growing: 'Growing', flowering: 'Flowering', fruiting: 'Fruiting', damaged: 'Damaged' };
const KALUPPA = 'kaluppa';
const round = (n) => Math.round(n * 100) / 100;
const total = (rows, key) => round(rows.reduce((s, r) => s + r[key], 0));
const byKey = (rows) => new Map(rows.map((r) => [String(r._id), r]));
const fullName = (u) => `${u.firstName} ${u.lastName}`;

/**
 * Who and what a report covers. Kaluppa: every association, or the one it filters by. A Group Manager: always its own
 * association (null when it has none, which matches nothing), whatever the query says.
 * @param {object} actor @param {{ period?: string, association?: string }} query
 */
async function contextFor(actor, { period = 'last_12_months', association }) {
  const byAssociation = seesEveryAssociation(actor);
  const kaluppaFarmIds = await findKaluppaFarmIds();
  return {
    range: reportRange(period),
    scope: byAssociation ? association : actor.associationId ? String(actor.associationId) : null,
    byAssociation,
    // Breakdown rows: associations for Kaluppa, farmers for a Group Manager; Kaluppa farms are a row of their own.
    recordGroup: groupOrKaluppa(byAssociation ? 'association' : 'owner', kaluppaFarmIds),
    beanGroup: byAssociation ? '$association' : '$farmer',
    farmField: byAssociation ? 'association' : 'owner',
  };
}

/** Month rows (`_id` "YYYY-MM") into the range's buckets. */
function monthly(range, rows, value = (r) => r.kg) {
  const values = range.keys.map(() => 0);
  for (const row of rows) {
    const i = range.keys.indexOf(row._id);
    if (i >= 0) values[i] = round(values[i] + value(row));
  }
  return values;
}

const salesAllowed = (actor) => userCan(actor, 'orders.manage');
async function requireSales(actor) {
  if (!(await salesAllowed(actor))) throw new AppError(403, 'Store sales are in Kaluppa’s reports only.', { code: 'FORBIDDEN' });
}

const SECTIONS = {
  async summary(actor, ctx) {
    const { range, scope } = ctx;
    const [harvest, beans, farms, farmers, waiting, sales] = await Promise.all([
      harvestReport(scope, range, null),
      beanReport(scope, range, null),
      farmReport(scope, ctx.farmField),
      listApprovedFarmers(scope),
      scope === undefined ? countFarmersEverywhere().then((c) => c.waiting) : scope ? countWaiting(scope) : 0,
      salesAllowed(actor).then((ok) => (ok ? soldRows(range.from, range.to) : null)),
    ]);
    const kg = total(harvest.groups, 'kg');
    return {
      harvest: { kg, ...compare(kg, total(harvest.previous, 'kg')) },
      beans: { kg: total(beans.groups, 'kg'), paidCentavos: total(beans.groups, 'paid') },
      farms: { count: total(farms, 'farms'), ha: total(farms, 'ha') },
      farmers: { count: farmers.length, newInPeriod: farmers.filter((f) => f.approvedAt >= range.from && f.approvedAt < range.to).length, waiting },
      ...(sales && { sales: { centavos: total(sales, 'totalCentavos'), count: sales.length } }),
    };
  },

  async harvest(_actor, { range, scope }) {
    const { months } = await harvestReport(scope, range, null);
    return {
      labels: range.labels,
      series: Object.keys(VARIETIES).map((variety) => ({ variety, values: monthly(range, months.filter((m) => m._id.variety === variety).map((m) => ({ _id: m._id.month, kg: m.kg }))) })),
    };
  },

  async beans(_actor, { range, scope }) {
    const { months } = await beanReport(scope, range, null);
    return { labels: range.labels, values: monthly(range, months) };
  },

  async sales(actor, { range }) {
    await requireSales(actor);
    const rows = await soldRows(range.from, range.to);
    return { labels: range.labels, values: monthly(range, rows.map((o) => ({ _id: range.keyOf(o.soldAt), kg: o.totalCentavos }))), count: rows.length };
  },

  async trees(_actor, { scope }) {
    const { stages } = await treeReport(scope, null);
    const counts = byKey(stages);
    return { total: total(stages, 'trees'), byStage: TREE_STAGES.map((stage) => ({ stage, count: counts.get(stage)?.trees ?? 0 })) };
  },

  async breakdown(_actor, ctx) {
    const { range, scope, byAssociation } = ctx;
    const [harvest, beans, trees, farms, farmers, associations] = await Promise.all([
      harvestReport(scope, range, ctx.recordGroup),
      beanReport(scope, range, ctx.beanGroup),
      treeReport(scope, ctx.recordGroup),
      farmReport(scope, ctx.farmField),
      listApprovedFarmers(scope),
      byAssociation ? listActiveOptions() : [],
    ]);
    const [h, b, t, f] = [harvest.groups, beans.groups, trees.groups, farms].map(byKey);
    const figures = (key, { sells = true } = {}) => ({
      farms: f.get(key)?.farms ?? 0,
      trees: t.get(key)?.trees ?? 0,
      harvestKg: round(h.get(key)?.kg ?? 0),
      beansKg: sells ? round(b.get(key)?.kg ?? 0) : null,
      paidCentavos: sells ? b.get(key)?.paid ?? 0 : null,
    });
    const hasData = (key) => [f, t, h, b].some((m) => m.has(key));
    const rows = byAssociation
      ? associations
        .filter((a) => scope === undefined || String(a._id) === scope)
        .map((a) => ({ name: a.name, farmers: farmers.filter((p) => String(p.association) === String(a._id)).length, ...figures(String(a._id)) }))
      : farmers
        .map((p) => ({ name: fullName(p.user), farmers: null, ...figures(String(p.user._id)) }))
        .sort((x, y) => x.name.localeCompare(y.name));
    if (byAssociation && scope === undefined && hasData('null')) rows.push({ name: 'No association', farmers: null, ...figures('null') });
    if (hasData(KALUPPA)) rows.push({ name: 'Kaluppa farms', farmers: null, ...figures(KALUPPA, { sells: false }) });
    return { kind: byAssociation ? 'association' : 'farmer', rows };
  },
};

/**
 * One Reports section (PHASE-2-SPEC §3.12) for the period and association filter, scoped to the actor.
 * @param {object} actor
 * @param {keyof typeof SECTIONS} section
 * @param {{ period?: string, association?: string }} query
 */
export async function getReport(actor, section, query) {
  return SECTIONS[section](actor, await contextFor(actor, query));
}

const peso = (centavos) => (centavos == null ? '' : (centavos / 100).toFixed(2));
const blank = (v) => v ?? '';

/** Each export section as a titled table. */
const TABLES = {
  harvest: (d, { range }) => ({
    title: 'Harvest by variety (kg)',
    header: ['Month', ...d.series.map((s) => VARIETIES[s.variety]), 'Total (kg)'],
    rows: range.csvLabels.map((label, i) => [label, ...d.series.map((s) => s.values[i]), round(d.series.reduce((sum, s) => sum + s.values[i], 0))]),
  }),
  beans: (d, { range }) => ({ title: 'Beans bought by Kaluppa (kg)', header: ['Month', 'Beans bought (kg)'], rows: range.csvLabels.map((label, i) => [label, d.values[i]]) }),
  sales: (d, { range }) => ({ title: 'Store sales (PHP)', header: ['Month', 'Sales (PHP)'], rows: range.csvLabels.map((label, i) => [label, peso(d.values[i])]) }),
  trees: (d) => ({
    title: 'Trees by stage',
    header: ['Stage', 'Trees', 'Share'],
    rows: d.byStage.map((s) => [STAGE_LABELS[s.stage], s.count, d.total ? `${Math.round((s.count / d.total) * 100)}%` : '0%']),
  }),
  breakdown: (d) =>
    d.kind === 'association'
      ? {
        title: 'By association',
        header: ['Association', 'Farmers', 'Farms', 'Trees', 'Harvest (kg)', 'Beans sold (kg)', 'Paid (PHP)'],
        rows: d.rows.map((r) => [r.name, blank(r.farmers), r.farms, r.trees, r.harvestKg, blank(r.beansKg), peso(r.paidCentavos)]),
      }
      : {
        title: 'By farmer',
        header: ['Farmer', 'Farms', 'Trees', 'Harvest (kg)', 'Beans sold (kg)', 'Earned (PHP)'],
        rows: d.rows.map((r) => [r.name, r.farms, r.trees, r.harvestKg, blank(r.beansKg), peso(r.paidCentavos)]),
      },
};

/**
 * The CSV for one section, or every section the actor may see stacked under their titles ("Export all").
 * @param {object} actor @param {{ section: string, period?: string, association?: string }} query
 * @returns {Promise<{ filename: string, csv: string }>}
 */
export async function exportReport(actor, { section, ...query }) {
  if (section === 'sales') await requireSales(actor);
  const ctx = await contextFor(actor, query);
  const names = section === 'all' ? ['harvest', 'beans', ...((await salesAllowed(actor)) ? ['sales'] : []), 'trees', 'breakdown'] : [section];
  const tables = await Promise.all(names.map(async (name) => TABLES[name](await SECTIONS[name](actor, ctx), ctx)));
  const csv = section === 'all'
    ? tables.map((t) => toCsv([t.title], []) + toCsv(t.header, t.rows)).join('\r\n')
    : toCsv(tables[0].header, tables[0].rows);
  return { filename: `report-${section}-${ctx.range.period}.csv`, csv };
}
