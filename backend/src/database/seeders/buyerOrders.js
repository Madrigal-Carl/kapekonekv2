// Juana's (`buyer`) demo orders: every status, both methods, both payments, refunds and notifications (PRODUCT-SPEC §11).
import { MUNICIPALITY_CENTERS } from '../../constants/geo.js';
import { BUYER_CANCEL_REASONS, REJECT_REASONS } from '../../constants/orderStatus.js';
import { quoteForPoint } from '../../services/deliveryQuote.service.js';
import { buyerNotice } from '../../services/orderStatus.service.js';
import { etaWindow } from '../../utils/businessDays.js';
import { feeForDistance, haversineKm } from '../../utils/deliveryFee.js';
import { nextOrderNumber } from '../../utils/orderNumber.js';

const DAY = 86_400_000;
const RIDER = { name: 'Jun R.', phone: '09175550102' };

/**
 * [days ago, status, method ('home'|'work'|'mama'|'pickup'), payment ('cash'|'GCash'|'Maya'), items [slug, qty][], extra].
 * Pending orders stay younger than 2 days so the expiry sweep leaves them alone after seeding.
 */
const PLAN = [
  [0.1, 'pending', 'home', 'GCash', [['barako-medium-roast', 2], ['liberica-green-beans', 1.5], ['excelsa-green-beans', 1]]],
  [1.2, 'pending', 'pickup', 'cash', [['robusta-dark-roast', 2]]],
  [2.5, 'reserved', 'home', 'GCash', [['robusta-green-beans', 2]]],
  [3, 'out_for_delivery', 'home', 'cash', [['arabica-light-roast', 2]]],
  [4, 'ready_for_pickup', 'pickup', 'cash', [['robusta-dark-roast', 2]]],
  [5, 'processing', 'work', 'Maya', [['robusta-dark-roast', 3]]],
  [9, 'cancelled', 'work', 'GCash', [['arabica-ground', 1]], { reasonCode: 'wrong_receipt' }],
  [12, 'rejected', 'home', 'cash', [['excelsa-medium-roast', 2]], { reasonCode: 'out_of_stock' }],
  [14, 'sold', 'work', 'cash', [['barako-medium-roast', 3]]],
  [18, 'expired', 'home', 'GCash', [['excelsa-ground', 2]]],
  [20, 'sold', 'pickup', 'GCash', [['arabica-green-beans', 1]]],
  [21, 'rejected', 'pickup', 'Maya', [['arabica-ground', 1]], { reasonCode: 'invalid_receipt', refundRef: '7023118842' }],
  [25, 'cancelled', 'home', 'cash', [['robusta-dark-roast', 2]], { reasonCode: 'ordered_by_mistake' }],
  [30, 'sold', 'home', 'Maya', [['liberica-green-beans', 2]]],
  [45, 'sold', 'mama', 'cash', [['robusta-ground', 2], ['barako-medium-roast', 1]]],
];

const PATH = {
  delivery: ['pending', 'reserved', 'processing', 'out_for_delivery', 'sold'],
  pickup: ['pending', 'reserved', 'processing', 'ready_for_pickup', 'sold'],
};
const STEP_AFTER = { reserved: 0.3, processing: 0.8, out_for_delivery: 1.5, ready_for_pickup: 1.5, sold: 2.5, cancelled: 0.2, rejected: 0.5, expired: 3 };

async function quoteFor(address, origin, rules) {
  const [lng, lat] = address.location?.coordinates ?? [];
  if (lat != null) {
    const { distanceKm, feeCentavos, distanceSource } = await quoteForPoint({ lat, lng });
    return { distanceKm, feeCentavos, distanceSource };
  }
  // Unpinned (Mama's house): straight-line distance from the town centre, like the live fallback.
  const distanceKm = Math.round(haversineKm(origin, MUNICIPALITY_CENTERS[address.municipality]) * rules.roadFactorFallback * 10) / 10;
  return { distanceKm, feeCentavos: feeForDistance(distanceKm, rules), distanceSource: 'fallback' };
}

/**
 * @param {{ buyer: object, kaluppaId: unknown, addresses: Record<'home'|'work'|'mama', object>, products: Record<string, object>, fee: object, eta: object, pickup: object, now?: number }} input
 * @returns {Promise<{ orders: object[], notices: Array<(order: object) => object>, reserved: Array<[unknown, number]>, sold: Array<[unknown, number]> }>}
 */
export async function buildBuyerOrders({ buyer, kaluppaId, addresses, products, fee, eta, pickup, now = Date.now() }) {
  const quotes = {};
  for (const key of Object.keys(addresses)) quotes[key] = await quoteFor(addresses[key], pickup.location, fee);
  const orders = [];
  const reserved = [];
  const sold = [];

  for (const [daysAgo, status, where, pay, lines, extra = {}] of PLAN) {
    const placedAt = new Date(now - daysAgo * DAY);
    const at = (step) => new Date(placedAt.getTime() + STEP_AFTER[step] * DAY);
    const method = where === 'pickup' ? 'pickup' : 'delivery';
    const items = lines.map(([slug, quantity]) => {
      const p = products[slug];
      return {
        product: p._id, name: p.name, slug, image: p.images[0]?.url, variety: p.variety, coffeeType: p.coffeeType,
        unit: p.unit, unitLabel: p.unitLabel, priceCentavos: p.priceCentavos, quantity, lineTotalCentavos: Math.round(p.priceCentavos * quantity),
      };
    });
    const subtotalCentavos = items.reduce((s, it) => s + it.lineTotalCentavos, 0);
    const quote = method === 'delivery' ? quotes[where] : null;
    const deliveryFeeCentavos = quote?.feeCentavos ?? 0;
    const ewallet = pay !== 'cash';

    const steps = ['cancelled', 'rejected', 'expired'].includes(status) ? ['pending', status] : PATH[method].slice(0, PATH[method].indexOf(status) + 1);
    const reasons = status === 'cancelled' ? BUYER_CANCEL_REASONS : REJECT_REASONS;
    const reason = extra.reasonCode ? { reasonCode: extra.reasonCode, reason: reasons[extra.reasonCode] } : {};
    const statusHistory = steps.map((step) => ({
      status: step,
      at: step === 'pending' ? placedAt : at(step),
      by: step === 'pending' || step === 'cancelled' ? buyer._id : step === 'expired' ? null : kaluppaId,
      byRole: step === 'pending' || step === 'cancelled' ? 'buyer' : step === 'expired' ? 'system' : 'kaluppa',
      ...(['cancelled', 'rejected'].includes(step) && reason),
      ...(step === 'out_for_delivery' && { note: `Rider: ${RIDER.name} · ${RIDER.phone}` }),
    }));
    const wasReserved = steps.includes('reserved');
    const window = wasReserved ? etaWindow(at('reserved'), eta) : null;
    const a = method === 'delivery' ? addresses[where] : null;

    orders.push({
      orderNumber: await nextOrderNumber(placedAt),
      buyer: buyer._id,
      items,
      subtotalCentavos,
      deliveryFeeCentavos,
      totalCentavos: subtotalCentavos + deliveryFeeCentavos,
      fulfillment: {
        method,
        contactName: a ? a.recipientName : `${buyer.firstName} ${buyer.lastName}`,
        contactPhone: a ? a.phone : buyer.contactNumber,
        ...(a && {
          address: { label: a.label, customLabel: a.customLabel, recipientName: a.recipientName, phone: a.phone, province: a.province, municipality: a.municipality, barangay: a.barangay, street: a.street, postalCode: a.postalCode, location: a.location },
          distanceKm: quote.distanceKm,
          distanceSource: quote.distanceSource,
        }),
        ...(!a && { pickup: { name: pickup.name, address: pickup.address, hours: pickup.hours, location: pickup.location } }),
        ...(steps.includes('out_for_delivery') && { rider: RIDER }),
        ...(window && { etaFrom: window.from, etaTo: window.to }),
      },
      payment: {
        method: ewallet ? 'e_wallet' : 'cash',
        provider: ewallet ? pay : null,
        // shortcut: seeded e-wallet orders have no receipt image (the order page says so); real orders always upload one.
        ...(ewallet && { submittedAt: placedAt }),
        ...(ewallet && wasReserved && { verifiedAt: at('reserved'), verifiedBy: kaluppaId }),
        ...(!ewallet && status === 'sold' && { cashCollectedAt: at('sold') }),
      },
      status,
      statusHistory,
      stockReserved: wasReserved && !['sold', 'cancelled', 'rejected'].includes(status),
      ...(status === 'cancelled' && { cancellation: { by: buyer._id, ...reason, at: at('cancelled') } }),
      ...(status === 'rejected' && { rejection: { by: kaluppaId, ...reason, at: at('rejected') } }),
      ...(status === 'expired' && { expiredAt: at('expired') }),
      refund: !ewallet || !['cancelled', 'rejected', 'expired'].includes(status)
        ? { status: 'not_applicable' }
        : extra.refundRef
          ? { status: 'refunded', referenceNumber: extra.refundRef, refundedAt: new Date(at(status).getTime() + DAY), refundedBy: kaluppaId }
          : { status: 'pending' },
      createdAt: placedAt,
      updatedAt: statusHistory.at(-1).at,
    });
    if (status === 'sold') sold.push(...items.map((it) => [it.product, it.quantity]));
    if (orders.at(-1).stockReserved) reserved.push(...items.map((it) => [it.product, it.quantity]));
  }
  return { orders, reserved, sold };
}

/** One notification per order for its current status; older ones are already read. */
export const noticesFor = (inserted, now = Date.now()) =>
  inserted.map((order) => {
    const at = order.statusHistory.at(-1).at;
    return { ...buyerNotice(order), user: order.buyer, createdAt: at, readAt: now - at > 2 * DAY ? at : null };
  });
