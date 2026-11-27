import { STATUS_LABELS } from '../constants/orderStatus.js';
import { findUserIdsByName, findUserIdsWithRole } from '../repositories/user.repository.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { buildExport } from './export.service.js';
import { listOrderTable } from './order.service.js';

const EXPORT_MAX = 5000;
const manilaStamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' });

/** The Kaluppa filters as a Mongo scope, plus the customers whose name matches the search. */
async function scopeFor({ type, method, payment, q }) {
  const scope = {};
  if (method) scope['fulfillment.method'] = method;
  if (payment) scope['payment.method'] = payment;
  if (type) {
    const farmers = await findUserIdsWithRole('farmer');
    scope.buyer = type === 'farmer' ? { $in: farmers } : { $nin: farmers };
  }
  const orIds = q ? await findUserIdsByName(q.split(/\s+/).map(containsPattern)) : [];
  return { scope, orIds };
}

/**
 * Every buyer and farmer order, one numbered page (PHASE-2-SPEC §3.8): Status group, customer type, method, payment, search.
 * @param {{ status: string, q: string, type?: 'buyer'|'farmer', method?: string, payment?: string, page: number, limit: number }} query
 */
export async function listAdminOrders(query) {
  const { scope, orIds } = await scopeFor(query);
  return listOrderTable(scope, { group: query.status, q: query.q, page: query.page, limit: query.limit }, orIds);
}

const GROUP_LABELS = { to_confirm: 'To confirm', preparing: 'Preparing', on_the_way: 'On the way', completed: 'Completed', closed: 'Closed', all: 'All' };
const FILTER_LABELS = {
  type: { buyer: 'Buyers', farmer: 'Farmers' },
  method: { delivery: 'Delivery', pickup: 'Pickup' },
  payment: { e_wallet: 'E-wallet', cash: 'Cash' },
};
const peso = (centavos) => `PHP ${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The table's filters as CSV or PDF (up to 5,000 orders, newest first; PHASE-2-SPEC §3.17).
 * @param {object} actor
 * @param {{ format: 'csv'|'pdf', status: string, q: string, type?: string, method?: string, payment?: string }} query
 */
export async function exportAdminOrders(actor, { format, ...query }) {
  const { scope, orIds } = await scopeFor(query);
  const { items } = await listOrderTable(scope, { group: query.status, q: query.q, page: 1, limit: EXPORT_MAX }, orIds);
  const rows = items.map((o) => [
    o.orderNumber,
    manilaStamp.format(o.createdAt).replace(',', ''),
    o.customer?.name ?? 'Deleted account',
    o.customer?.role === 'farmer' ? 'Farmer' : 'Buyer',
    o.items.map((i) => `${i.name} × ${i.quantity}`).join('; '),
    (o.totalCentavos / 100).toFixed(2),
    o.fulfillment.method === 'pickup' ? 'Pickup' : `Delivery · ${o.fulfillment.address?.municipality ?? ''}`,
    o.payment.method === 'cash' ? 'Cash' : o.payment.provider,
    STATUS_LABELS[o.status],
  ]);
  const filters = [
    ['Status', GROUP_LABELS[query.status] ?? STATUS_LABELS[query.status] ?? query.status],
    ...(query.q ? [['Search', query.q]] : []),
    ...['type', 'method', 'payment'].filter((k) => query[k]).map((k) => [{ type: 'Customer', method: 'Delivery', payment: 'Payment' }[k], FILTER_LABELS[k][query[k]] ?? query[k]]),
  ];
  const total = items.reduce((sum, o) => sum + o.totalCentavos, 0);
  return buildExport(actor, format, {
    name: 'orders',
    title: 'Orders',
    filters,
    landscape: true,
    kpis: [{ label: 'Orders', value: items.length.toLocaleString('en-PH') }, { label: 'Total', value: peso(total) }],
    tables: [{ title: 'Orders', header: ['Order', 'Placed', 'Customer', 'Customer type', 'Items', 'Total (PHP)', 'Delivery', 'Payment', 'Status'], rows }],
  }, 'orders');
}
