import { VARIETIES } from '../constants/catalog.js';
import { countActiveAssociations, findAssociationById } from '../repositories/association.repository.js';
import { capUsedKg, completedRows, countPendingListings, pendingTotals, recentListings } from '../repositories/bean.repository.js';
import { farmCounts } from '../repositories/farm.repository.js';
import { countFarmersByAssociation, countFarmersEverywhere, countWaiting, findProfileByUser, listWaiting } from '../repositories/farmerProfile.repository.js';
import { harvestRows } from '../repositories/harvest.repository.js';
import { countOrdersToConfirm, listOrdersPage, listOrdersToConfirm, soldRows } from '../repositories/order.repository.js';
import { findLowStock } from '../repositories/product.repository.js';
import { countNeedingReply } from '../repositories/review.repository.js';
import { countActiveGroups, stageTotals } from '../repositories/treeGroup.repository.js';
import { findRecipient } from '../repositories/user.repository.js';
import { bucketize, compare, periodRange } from '../utils/period.js';
import { farmIdsFor } from './farm.service.js';
import { countUnreadChats } from './inbox.service.js';
import { userCan } from './permission.service.js';
import { seesEveryAssociation } from './policy.service.js';
import { LOW_STOCK_LINE } from '../schemas/rules.js';

const fullName = (u) => `${u.firstName} ${u.lastName}`;
const total = (rows, value) => rows.reduce((sum, row) => sum + value(row), 0);

/** The association a Group Manager acts for, from the session scope. */
const managedAssociation = (user) => (seesEveryAssociation(user) ? null : user.associationId ?? null);

/**
 * Sidebar badge counts. Only keys the user may act on, and only for data that exists so far
 * (M8: Group Manager `farmers`, Kaluppa `orders`; later milestones add beans, reviews and inbox).
 */
export async function badgesFor(user) {
  const badges = {};
  const associationId = managedAssociation(user);
  if (associationId && (await userCan(user, 'farmers.approve'))) badges.farmers = await countWaiting(associationId);
  if (await userCan(user, 'orders.manage')) badges.orders = (await countOrdersToConfirm()).all;
  if (await userCan(user, 'beans.review')) badges.beans = await countPendingListings();
  if (await userCan(user, 'reviews.moderate')) badges.reviews = await countNeedingReply();
  if (await userCan(user, 'inbox.use')) badges.inbox = await countUnreadChats(user);
  return badges;
}

/** The sidebar's association card (Sidebar.dc.html): farmer request state, or the Group Manager's counts; none for Kaluppa. */
export async function orgCardFor(user) {
  if (seesEveryAssociation(user)) return null;
  if (await userCan(user, 'farmers.approve')) {
    if (!user.associationId) return { kind: 'group_manager', association: null, farmers: 0, waiting: 0 };
    const [association, counts, waiting] = await Promise.all([findAssociationById(user.associationId), countFarmersByAssociation([user.associationId]), countWaiting(user.associationId)]);
    return { kind: 'group_manager', association: { id: String(association._id), name: association.name }, farmers: counts.get(String(user.associationId)).approved, waiting };
  }
  const profile = await findProfileByUser(user._id);
  const association = profile?.status === 'none' ? null : profile?.association;
  return { kind: 'farmer', status: profile?.status ?? 'none', association: association ? { id: String(association._id), name: association.name } : null };
}

/** The period the overview shows ("Showing this month · Nov 1 – Nov 30, 2026") and the chart's bucket labels. */
const periodView = (range) => ({ key: range.period, labels: range.labels, rangeText: range.rangeText, prevLabel: range.prevLabel });

/**
 * Harvest kilograms in the period, compared with the previous one, and the chart buckets:
 * one series, or one per variety (Group Manager).
 */
async function harvestFigures(farmIds, range, byVariety = false) {
  const [rows, before] = await Promise.all([harvestRows(farmIds, range.from, range.to), harvestRows(farmIds, range.prevFrom, range.prevTo)]);
  const kg = total(rows, (r) => r.yieldKg);
  const buckets = (list) => bucketize(range, list.map((r) => ({ at: r.harvestedAt, value: r.yieldKg })));
  return {
    kpi: { kg, count: rows.length, ...compare(kg, total(before, (r) => r.yieldKg)) },
    series: byVariety ? Object.keys(VARIETIES).map((variety) => ({ variety, values: buckets(rows.filter((r) => r.variety === variety)) })) : [{ values: buckets(rows) }],
  };
}

/** Beans Kaluppa bought (completed listings) in the period, compared, and the chart buckets. */
async function beanFigures(scope, range) {
  const [rows, before] = await Promise.all([completedRows(scope, range.from, range.to), completedRows(scope, range.prevFrom, range.prevTo)]);
  const kg = total(rows, (r) => r.completion.finalWeightKg);
  return {
    kpi: { kg, count: rows.length, ...compare(kg, total(before, (r) => r.completion.finalWeightKg)) },
    values: bucketize(range, rows.map((r) => ({ at: r.completion.at, value: r.completion.finalWeightKg }))),
  };
}

/** Active farms and trees in scope, as of now (the period doesn't apply). */
async function recordStock(farmIds) {
  const [farms, stages, groups] = await Promise.all([farmCounts(farmIds), stageTotals(farmIds), countActiveGroups(farmIds)]);
  const byPlace = new Map();
  for (const row of farms) byPlace.set(row._id.municipality, (byPlace.get(row._id.municipality) ?? 0) + row.count);
  return {
    farms: {
      count: total(farms, (r) => r.count),
      kaluppa: total(farms.filter((r) => r._id.ownerType === 'kaluppa'), (r) => r.count),
      byMunicipality: [...byPlace].map(([municipality, count]) => ({ municipality, count })),
    },
    trees: { count: Object.values(stages).reduce((a, b) => a + b, 0), groups },
    treesByStage: Object.entries(stages).map(([stage, count]) => ({ stage, count })),
  };
}

const beanRow = (l) => ({
  id: String(l._id),
  listingNumber: l.listingNumber,
  farmerName: l.farmer ? fullName(l.farmer) : 'Deleted account',
  association: l.association?.name ?? null,
  variety: l.variety,
  form: l.form,
  weightKg: l.weightKg,
  pricePerKgCentavos: l.pricePerKgCentavos,
  status: l.status,
  countsTowardCap: l.countsTowardCap,
  createdAt: l.createdAt,
  expiresAt: l.expiresAt ?? null,
  completedAt: l.completion?.at ?? null,
});

async function farmerOverview(user, range) {
  const scope = { farmer: user._id };
  const farmIds = await farmIdsFor(user);
  const [profile, stock, harvest, beans, pending, listings, usedKg, orders] = await Promise.all([
    findProfileByUser(user._id),
    recordStock(farmIds),
    harvestFigures(farmIds, range),
    beanFigures(scope, range),
    pendingTotals(scope),
    recentListings(scope, 3),
    capUsedKg(user._id),
    listOrdersPage({ buyer: user._id }, { page: 1, limit: 3 }),
  ]);
  const association = profile?.association;
  const manager = association?.groupManager ? await findRecipient(association.groupManager) : null;
  return {
    view: 'farmer',
    period: periodView(range),
    farmer: {
      status: profile?.status ?? 'none',
      association: association ? { id: String(association._id), name: association.name } : null,
      groupManager: manager ? { name: fullName(manager) } : null,
      rejectionReason: profile?.rejectionReason ?? null,
    },
    cap: { usedKg, limitKg: 5 },
    kpis: { farms: stock.farms, trees: stock.trees, harvest: harvest.kpi, beansSold: { ...beans.kpi, waiting: pending.count } },
    harvest: harvest.series[0].values,
    treesByStage: stock.treesByStage,
    beans: listings.map(beanRow),
    orders: orders.items.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      firstItem: o.items[0]?.name ?? '',
      itemCount: o.items.length,
      totalCentavos: o.totalCentavos,
      paymentMethod: o.payment.method,
      fulfillmentMethod: o.fulfillment.method,
      status: o.status,
    })),
  };
}

async function managerOverview(user, range) {
  const associationId = user.associationId ?? null;
  // Without an association a Group Manager sees no listings (`association: null` would match unaffiliated farmers).
  const scope = associationId ? { association: associationId } : { _id: null };
  const farmIds = await farmIdsFor(user);
  const [association, counts, waitingCount, waiting, stock, harvest, beans, pending, listings] = await Promise.all([
    associationId ? findAssociationById(associationId) : null,
    associationId ? countFarmersByAssociation([associationId]) : new Map(),
    associationId ? countWaiting(associationId) : 0,
    associationId ? listWaiting(associationId, 4) : [],
    recordStock(farmIds),
    harvestFigures(farmIds, range, true),
    beanFigures(scope, range),
    pendingTotals(scope),
    recentListings(scope, 3),
  ]);
  return {
    view: 'group_manager',
    period: periodView(range),
    association: association ? { id: String(association._id), name: association.name } : null,
    kpis: {
      farmers: counts.get(String(associationId))?.approved ?? 0,
      waiting: waitingCount,
      farms: stock.farms,
      trees: stock.trees,
      harvest: harvest.kpi,
      beans: { ...beans.kpi, waitingKg: pending.kg },
    },
    queue: waiting.map((p) => ({
      id: String(p.user._id),
      name: fullName(p.user),
      initials: `${p.user.firstName[0]}${p.user.lastName[0]}`.toUpperCase(),
      kind: p.transferRequest?.association ? 'transfer' : 'request',
      from: p.transferRequest?.association ? p.association?.name ?? null : null,
      requestedAt: p.transferRequest?.requestedAt ?? p.requestedAt,
    })),
    harvest: harvest.series,
    treesByStage: stock.treesByStage,
    beans: listings.map(beanRow),
  };
}

async function kaluppaOverview(range) {
  const [toConfirm, sold, soldBefore, farmers, associations, orders, lowStock, pending, beans, listings] = await Promise.all([
    countOrdersToConfirm(),
    soldRows(range.from, range.to),
    soldRows(range.prevFrom, range.prevTo),
    countFarmersEverywhere(),
    countActiveAssociations(),
    listOrdersToConfirm(4),
    findLowStock(4, LOW_STOCK_LINE),
    pendingTotals({}),
    beanFigures({}, range),
    recentListings({}, 3, ['pending', 'approved']),
  ]);
  const sales = total(sold, (o) => o.totalCentavos);
  return {
    view: 'kaluppa',
    period: periodView(range),
    kpis: {
      ordersToConfirm: toConfirm.all,
      receiptsToCheck: toConfirm.receipts,
      sales: { centavos: sales, count: sold.length, ...compare(sales, total(soldBefore, (o) => o.totalCentavos)) },
      beanListingsToReview: pending.count,
      beanKgOffered: pending.kg,
      farmers: farmers.approved,
      waitingFarmers: farmers.waiting,
      associations,
    },
    sales: bucketize(range, sold.map((o) => ({ at: o.soldAt, value: o.totalCentavos }))),
    beansBought: beans.values,
    orders: orders.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      buyerName: o.buyer ? fullName(o.buyer) : 'Deleted account',
      buyerRole: o.buyer?.roles.includes('farmer') ? 'farmer' : 'buyer',
      totalCentavos: o.totalCentavos,
      paymentMethod: o.payment.method,
      paymentProvider: o.payment.provider ?? null,
      fulfillmentMethod: o.fulfillment.method,
      status: o.status,
      createdAt: o.createdAt,
    })),
    beans: listings.map(beanRow),
    lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, category: p.category?.slug ?? null, stock: p.stock, unit: p.unit, unitLabel: p.unitLabel ?? null })),
  };
}

/**
 * The user's dashboard overview for a calendar period (PHASE-2-SPEC §3.14), scoped by policy.
 * Stock-like figures (farms, trees, orders to confirm, listings to review) are as of now.
 * @param {object} user
 * @param {{ period?: 'today'|'week'|'month'|'year' }} [query]
 * @param {Date} [now]
 */
export async function overviewFor(user, { period = 'month' } = {}, now = new Date()) {
  const range = periodRange(period, now);
  if (seesEveryAssociation(user)) return kaluppaOverview(range);
  if (await userCan(user, 'farmers.approve')) return managerOverview(user, range);
  return farmerOverview(user, range);
}
