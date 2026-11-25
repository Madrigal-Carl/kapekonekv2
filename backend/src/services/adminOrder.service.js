import { STATUS_LABELS } from '../constants/orderStatus.js';
import { findUserIdsByName, findUserIdsWithRole } from '../repositories/user.repository.js';
import { toCsv } from '../utils/csv.js';
import { containsPattern } from '../utils/escapeRegex.js';
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

/** The same filters as a CSV file (up to 5,000 orders, newest first). */
export async function exportAdminOrders(query) {
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
  return toCsv(['Order', 'Placed', 'Customer', 'Customer type', 'Items', 'Total (PHP)', 'Delivery', 'Payment', 'Status'], rows);
}
