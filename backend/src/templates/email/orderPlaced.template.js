import { renderLayout } from './layout.js';
import { etaText, itemLines, paymentText, totalLines } from './orderFormat.js';

/** @param {import('./orderFormat.js').OrderEmail & { expiryDays: number }} order */
export const orderPlaced = (order) => ({
  subject: `We received your order ${order.orderNumber}`,
  ...renderLayout({
    preheader: `Kaluppa will confirm ${order.orderNumber} within ${order.expiryDays} days.`,
    heading: 'Thanks for your order',
    paragraphs: [
      `Hi ${order.name},`,
      `We received order ${order.orderNumber}. Kaluppa will confirm it within ${order.expiryDays} days.`,
      ...itemLines(order),
      ...totalLines(order),
      `${order.method === 'delivery' ? 'Deliver to' : 'Pick up at'}: ${order.destination}`,
      paymentText(order),
      etaText(order),
    ].filter(Boolean),
    cta: { label: 'View your order', url: order.url },
    footnote:
      order.paymentMethod === 'e_wallet'
        ? `If Kaluppa doesn't confirm within ${order.expiryDays} days, the order expires and your payment is refunded.`
        : `If Kaluppa doesn't confirm within ${order.expiryDays} days, the order expires.`,
  }),
});
