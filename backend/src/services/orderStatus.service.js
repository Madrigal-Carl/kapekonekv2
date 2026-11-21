import { env } from '../config/env.js';
import {
  BUYER_CANCEL_REASONS, REJECT_REASONS, STAFF_CANCEL_REASONS, STATUS_LABELS,
} from '../constants/orderStatus.js';
import { ROLES } from '../constants/permissions.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { findExpirableIds, findOrderById, updateOrderIf } from '../repositories/order.repository.js';
import { addSoldCount, reserveStock, returnStock } from '../repositories/product.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { cancelReasonRule } from '../schemas/rules.js';
import { realtime } from '../sockets/realtime.js';
import { AppError } from '../utils/AppError.js';
import { etaWindow } from '../utils/businessDays.js';
import { notifyUsers } from './notification.service.js';
import { findOrderFor, orderEmailData, presentOrder } from './order.service.js';
import { getSetting } from './setting.service.js';

const DAY_MS = 86_400_000;

/**
 * The whole order state machine (PRODUCT-SPEC §3). `who` is the actor kind; `methods` limits it to a fulfilment method;
 * `reasons` (when present) makes a reason code required.
 */
export const TRANSITIONS = [
  { from: ['pending'], to: 'reserved', who: 'staff' },
  { from: ['pending', 'reserved'], to: 'rejected', who: 'staff', reasons: REJECT_REASONS },
  { from: ['pending'], to: 'cancelled', who: 'buyer', reasons: BUYER_CANCEL_REASONS },
  { from: ['reserved', 'processing', 'out_for_delivery', 'ready_for_pickup'], to: 'cancelled', who: 'staff', reasons: STAFF_CANCEL_REASONS },
  { from: ['pending'], to: 'expired', who: 'system' },
  { from: ['reserved'], to: 'processing', who: 'staff' },
  { from: ['processing'], to: 'out_for_delivery', who: 'staff', methods: ['delivery'] },
  { from: ['processing'], to: 'ready_for_pickup', who: 'staff', methods: ['pickup'] },
  { from: ['out_for_delivery', 'ready_for_pickup'], to: 'sold', who: 'staff' },
];

const findRule = (who, order, to) =>
  TRANSITIONS.find((t) => t.who === who && t.to === to && t.from.includes(order.status) && (!t.methods || t.methods.includes(order.fulfillment.method)));

const changedMeanwhile = () => new AppError(409, 'This order changed in the meantime. Refresh and try again.');
const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });

/** A reason code from the rule's list, and a written reason for "other". */
function checkReason(rule, { reasonCode, reason }) {
  if (!rule.reasons) return {};
  if (!reasonCode || !rule.reasons[reasonCode]) throw fieldError('reasonCode', 'Choose a reason');
  if (reasonCode !== 'other') return { reasonCode, reason: reason?.trim() || rule.reasons[reasonCode] };
  const parsed = cancelReasonRule.safeParse(reason ?? '');
  if (!parsed.success) throw fieldError('reason', parsed.error.issues[0].message);
  return { reasonCode, reason: parsed.data };
}

const actorRole = (actor) => (actor ? (actor.roles.includes(ROLES.KALUPPA) ? ROLES.KALUPPA : actor.roles[0]) : 'system');

const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

/** Buyer-facing copy for each status change (notification body). */
function updateText(order) {
  const { status, fulfillment: f, refund } = order;
  const refundNote = refund.status === 'pending' ? ' Your e-wallet payment will be refunded.' : '';
  switch (status) {
    case 'reserved': return 'Kaluppa confirmed your order and reserved your items.';
    case 'processing': return 'Kaluppa is preparing your order.';
    case 'out_for_delivery': return f.rider?.name ? `Rider: ${f.rider.name} · ${f.rider.phone}.` : 'Your order is on its way.';
    case 'ready_for_pickup': return `Pick it up at ${f.pickup.name}, ${f.pickup.address}. ${f.pickup.hours}.`;
    case 'sold': return 'Thanks for your order! You can now review your coffee.';
    case 'cancelled': return `${sentence(order.cancellation?.reason ?? 'The order was cancelled')}${refundNote}`;
    case 'rejected': return `${sentence(order.rejection?.reason ?? 'Kaluppa could not accept this order')}${refundNote}`;
    case 'expired': return `Kaluppa didn't confirm it within ${env.ORDER_EXPIRY_DAYS} days.${refundNote}`;
    default: return '';
  }
}

const TITLES = {
  reserved: 'confirmed', processing: 'is being prepared', out_for_delivery: 'is on the way', ready_for_pickup: 'is ready for pickup',
  sold: 'is complete', cancelled: 'was cancelled', rejected: 'was rejected', expired: 'expired',
};

/** Email, notification and live update for the buyer. Failures are logged; the change itself stands. */
async function announce(order) {
  const presented = await presentOrder(order);
  const buyer = await findUserById(order.buyer);
  try {
    if (buyer) {
      await enqueueEmail(EMAIL_JOBS.ORDER_STATUS_CHANGED, {
        ...orderEmailData(order, presented.eta), to: buyer.email, name: buyer.firstName,
        statusLabel: STATUS_LABELS[order.status], detail: updateText(order), refundStatus: order.refund.status,
        rider: order.fulfillment.rider?.name ? order.fulfillment.rider : null, pickup: order.fulfillment.pickup ?? null,
      });
    }
  } catch (error) {
    console.error(`[orders] could not queue the status email for ${order.orderNumber}: ${error.message}`);
  }
  await notifyUsers([order.buyer], {
    type: 'order_status',
    title: `Order ${order.orderNumber} ${TITLES[order.status]}`,
    body: updateText(order),
    link: `/orders/${order._id}`,
    data: { orderId: order._id, orderNumber: order.orderNumber, status: order.status },
  });
  realtime.toUser(order.buyer, 'order:updated', { orderId: order._id, status: order.status });
  return presented;
}

/** pending → reserved: claim the order first (so expiry and cancel can't race it), then take stock item by item. */
async function reserve(actor, order, now) {
  const claimed = await updateOrderIf(order._id, { status: 'pending' }, { $set: { status: 'reserved' } });
  if (!claimed) throw changedMeanwhile();
  const taken = [];
  const short = [];
  for (const item of order.items) {
    if (await reserveStock(item.product, item.quantity)) taken.push(item);
    else short.push(item.name);
  }
  if (short.length) {
    await Promise.all(taken.map((item) => returnStock(item.product, item.quantity)));
    await updateOrderIf(order._id, { status: 'reserved' }, { $set: { status: 'pending' } });
    throw new AppError(409, `Not enough stock for ${short.join(', ')}. Nothing was reserved.`);
  }
  const eta = etaWindow(now, await getSetting('delivery.eta'));
  return updateOrderIf(order._id, { status: 'reserved' }, {
    $set: {
      stockReserved: true,
      'fulfillment.etaFrom': eta.from,
      'fulfillment.etaTo': eta.to,
      ...(order.payment.method === 'e_wallet' && { 'payment.verifiedAt': now, 'payment.verifiedBy': actor._id }),
    },
    $push: { statusHistory: { status: 'reserved', at: now, by: actor._id, byRole: actorRole(actor) } },
  });
}

/**
 * Apply one transition with a conditional update, then its side effects on other collections.
 * @param {'staff'|'buyer'|'system'} who
 * @param {object|null} actor the user (null for the scheduler)
 * @param {object} order the order as read
 * @param {{ status: string, reasonCode?: string, reason?: string, note?: string, rider?: { name: string, phone: string } }} input
 */
async function apply(who, actor, order, input, now = new Date()) {
  const rule = findRule(who, order, input.status);
  if (!rule) {
    const extra = who === 'staff' && ['out_for_delivery', 'ready_for_pickup'].includes(input.status) ? ` for a ${order.fulfillment.method} order` : '';
    throw new AppError(409, `An order that is ${STATUS_LABELS[order.status].toLowerCase()} can't be marked ${STATUS_LABELS[input.status].toLowerCase()}${extra}.`);
  }
  if (rule.to === 'reserved') return announce(await reserve(actor, order, now));

  const reason = checkReason(rule, input);
  const to = rule.to;
  const set = { status: to };
  const ends = ['cancelled', 'rejected', 'expired'].includes(to);
  if (ends) set.stockReserved = false;
  if (ends && order.payment.method === 'e_wallet') set['refund.status'] = 'pending';
  if (to === 'cancelled') set.cancellation = { by: actor?._id, ...reason, at: now };
  if (to === 'rejected') set.rejection = { by: actor?._id, ...reason, at: now };
  if (to === 'expired') set.expiredAt = now;
  if (to === 'out_for_delivery' && input.rider) set['fulfillment.rider'] = input.rider;
  if (to === 'sold' && order.payment.method === 'cash') set['payment.cashCollectedAt'] = now;
  const history = { status: to, at: now, by: actor?._id ?? null, byRole: actorRole(actor), ...reason, ...(input.note && { note: input.note }) };

  const before = await updateOrderIf(order._id, { status: order.status }, { $set: set, $push: { statusHistory: history } }, 'before');
  if (!before) throw changedMeanwhile();
  if (ends && before.stockReserved) await Promise.all(before.items.map((item) => returnStock(item.product, item.quantity)));
  if (to === 'sold') await Promise.all(before.items.map((item) => addSoldCount(item.product, item.quantity)));
  return announce(await findOrderById(order._id));
}

/**
 * Staff transition (`orders.manage`). Every pair not in TRANSITIONS is a 409.
 * @param {object} actor
 * @param {unknown} orderId
 * @param {{ status: string, reasonCode?: string, reason?: string, note?: string, rider?: { name: string, phone: string } }} input
 */
export async function transition(actor, orderId, input) {
  const order = await findOrderById(orderId);
  if (!order) throw new AppError(404, "We couldn't find that order.");
  return apply('staff', actor, order, input);
}

/** The buyer cancels their own pending order. */
export async function cancelByBuyer(user, orderId, { reasonCode, reason }) {
  const order = await findOrderFor(user, orderId);
  if (String(order.buyer) !== String(user._id)) throw new AppError(404, "We couldn't find that order.");
  return apply('buyer', user, order, { status: 'cancelled', reasonCode, reason });
}

/** Kaluppa records the e-wallet refund. Only a pending refund can be marked. */
export async function markRefunded(actor, orderId, { referenceNumber }) {
  const now = new Date();
  const order = await updateOrderIf(orderId, { 'refund.status': 'pending' }, {
    $set: { 'refund.status': 'refunded', 'refund.referenceNumber': referenceNumber, 'refund.refundedAt': now, 'refund.refundedBy': actor._id },
  });
  if (!order) throw new AppError(409, "There's no pending refund on this order.");
  await notifyUsers([order.buyer], {
    type: 'order_status',
    title: `Refund sent for ${order.orderNumber}`,
    body: `Kaluppa refunded your ${order.payment.provider} payment. Reference no. ${referenceNumber}.`,
    link: `/orders/${order._id}`,
    data: { orderId: order._id, orderNumber: order.orderNumber, status: order.status, refund: 'refunded' },
  });
  realtime.toUser(order.buyer, 'order:updated', { orderId: order._id, status: order.status });
  return presentOrder(order);
}

/**
 * Expire pending orders older than ORDER_EXPIRY_DAYS. Each is a conditional update, so an order
 * Kaluppa confirms meanwhile stays reserved.
 * @param {Date} now
 * @returns {Promise<number>} how many expired
 */
export async function expirePendingOrders(now) {
  const ids = await findExpirableIds(new Date(now.getTime() - env.ORDER_EXPIRY_DAYS * DAY_MS));
  let expired = 0;
  for (const id of ids) {
    const order = await findOrderById(id);
    if (order?.status !== 'pending') continue;
    try {
      await apply('system', null, order, { status: 'expired' }, now);
      expired += 1;
    } catch (error) {
      if (error.statusCode !== 409) throw error; // confirmed or cancelled meanwhile
    }
  }
  return expired;
}
