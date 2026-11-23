import { countActiveAssociations, findAssociationById } from '../repositories/association.repository.js';
import { capUsedKg, countPendingListings } from '../repositories/bean.repository.js';
import { countFarmersByAssociation, countFarmersEverywhere, countWaiting, findProfileByUser, listWaiting } from '../repositories/farmerProfile.repository.js';
import { countOrdersToConfirm, listOrdersToConfirm, sumSalesByMonth } from '../repositories/order.repository.js';
import { findLowStock } from '../repositories/product.repository.js';
import { findRecipient } from '../repositories/user.repository.js';
import { userCan } from './permission.service.js';
import { seesEveryAssociation } from './policy.service.js';

const MANILA_OFFSET_MS = 8 * 3600 * 1000;
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const fullName = (u) => `${u.firstName} ${u.lastName}`;

/**
 * The last `n` calendar months in Manila, oldest first: `{ keys: ['2026-06', …], labels: ['Jun', …], since }`.
 * @param {number} n
 * @param {Date} [now]
 */
export function lastMonths(n, now = new Date()) {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS);
  const [y, m] = [manila.getUTCFullYear(), manila.getUTCMonth()];
  const starts = Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - (n - 1 - i), 1)));
  return {
    keys: starts.map((d) => d.toISOString().slice(0, 7)),
    labels: starts.map((d) => MONTH.format(d)),
    since: new Date(starts[0].getTime() - MANILA_OFFSET_MS),
  };
}

/** A chart with no data yet (farms, harvests and beans arrive in M9/M10). */
const emptySeries = (n) => {
  const { labels } = lastMonths(n);
  return { labels, values: labels.map(() => 0) };
};

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

async function farmerOverview(user) {
  const profile = await findProfileByUser(user._id);
  const association = profile?.association;
  const manager = association?.groupManager ? await findRecipient(association.groupManager) : null;
  return {
    view: 'farmer',
    farmer: {
      status: profile?.status ?? 'none',
      association: association ? { id: String(association._id), name: association.name } : null,
      groupManager: manager ? { name: fullName(manager) } : null,
      rejectionReason: profile?.rejectionReason ?? null,
    },
    cap: { usedKg: await capUsedKg(user._id), limitKg: 5 },
    kpis: { farms: 0, trees: 0, harvestThisYearKg: 0, beansSoldKg: 0 },
    harvestByMonth: emptySeries(12),
    treesByStage: [],
    beans: [],
    orders: [], // the farmer store arrives in M11
  };
}

async function managerOverview(user) {
  const associationId = user.associationId;
  const [association, counts, waitingCount, waiting] = associationId
    ? await Promise.all([findAssociationById(associationId), countFarmersByAssociation([associationId]), countWaiting(associationId), listWaiting(associationId, 4)])
    : [null, new Map(), 0, []];
  return {
    view: 'group_manager',
    association: association ? { id: String(association._id), name: association.name } : null,
    kpis: { farmers: counts.get(String(associationId))?.approved ?? 0, waiting: waitingCount, farms: 0, harvestThisYearKg: 0, beansKg: 0 },
    queue: waiting.map((p) => ({
      id: String(p.user._id),
      name: fullName(p.user),
      initials: `${p.user.firstName[0]}${p.user.lastName[0]}`.toUpperCase(),
      kind: p.transferRequest?.association ? 'transfer' : 'request',
      from: p.transferRequest?.association ? p.association?.name ?? null : null,
      requestedAt: p.transferRequest?.requestedAt ?? p.requestedAt,
    })),
    harvestByMonth: { ...emptySeries(12), series: [] },
    treesByStage: [],
    beans: [],
  };
}

async function kaluppaOverview() {
  const months = lastMonths(6);
  const [toConfirm, sales, farmers, associations, orders, lowStock, beansToReview] = await Promise.all([
    countOrdersToConfirm(),
    sumSalesByMonth(months.since),
    countFarmersEverywhere(),
    countActiveAssociations(),
    listOrdersToConfirm(4),
    findLowStock(4),
    countPendingListings(),
  ]);
  const salesValues = months.keys.map((k) => sales.get(k) ?? 0);
  return {
    view: 'kaluppa',
    kpis: {
      ordersToConfirm: toConfirm.all,
      receiptsToCheck: toConfirm.receipts,
      salesThisMonthCentavos: salesValues.at(-1),
      salesLastMonthCentavos: salesValues.at(-2),
      beanListingsToReview: beansToReview,
      farmers: farmers.approved,
      waitingFarmers: farmers.waiting,
      associations,
    },
    salesByMonth: { labels: months.labels, values: salesValues },
    beansByMonth: emptySeries(6),
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
    beans: [],
    lowStock: lowStock.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, category: p.category?.slug ?? null, stock: p.stock, unit: p.unit, unitLabel: p.unitLabel ?? null })),
  };
}

/** The overview of the user's dashboard (PHASE-2-SPEC q11), scoped by policy. */
export async function overviewFor(user) {
  if (seesEveryAssociation(user)) return kaluppaOverview();
  if (await userCan(user, 'farmers.approve')) return managerOverview(user);
  return farmerOverview(user);
}
