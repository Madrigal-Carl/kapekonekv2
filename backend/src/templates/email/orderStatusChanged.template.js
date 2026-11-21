import { renderLayout } from './layout.js';
import { etaText, itemLines, peso, totalLines } from './orderFormat.js';

const HEADINGS = {
  reserved: 'Your order is confirmed',
  processing: 'Kaluppa is preparing your order',
  out_for_delivery: 'Your order is on the way',
  ready_for_pickup: 'Your order is ready for pickup',
  sold: 'Thanks for your order',
  cancelled: 'Your order was cancelled',
  rejected: 'Your order was rejected',
  expired: 'Your order expired',
};

/**
 * Every status change (PRODUCT-SPEC §6): rider for out for delivery, pickup address and hours, reason and refund note.
 * @param {import('./orderFormat.js').OrderEmail & { statusLabel: string, detail: string, refundStatus: string,
 *   rider: { name: string, phone: string } | null, pickup: { name: string, address: string, hours: string } | null }} order
 */
export function orderStatusChanged(order) {
  const paragraphs = [`Hi ${order.name},`, `Order ${order.orderNumber} is now: ${order.statusLabel}.`, order.detail];
  if (order.status === 'reserved') paragraphs.push(etaText(order));
  if (order.status === 'out_for_delivery' && order.paymentMethod === 'cash') paragraphs.push(`Please prepare ${peso(order.totalCentavos)} in cash for the rider.`);
  if (order.status === 'ready_for_pickup' && order.paymentMethod === 'cash') paragraphs.push(`Please bring ${peso(order.totalCentavos)} in cash.`);
  if (order.status === 'sold') paragraphs.push(...itemLines(order), ...totalLines(order));
  return {
    subject: `${order.orderNumber}: ${order.statusLabel}`,
    ...renderLayout({
      preheader: order.detail,
      heading: HEADINGS[order.status] ?? `Order ${order.statusLabel}`,
      paragraphs: paragraphs.filter(Boolean),
      cta: { label: 'View your order', url: order.url },
      footnote: order.refundStatus === 'pending' ? 'Kaluppa will send your refund and add the reference number to this order.' : undefined,
    }),
  };
}
