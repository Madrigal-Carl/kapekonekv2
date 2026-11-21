import { renderLayout } from './layout.js';
import { itemLines, peso, totalLines } from './orderFormat.js';

/** @param {import('./orderFormat.js').OrderEmail & { buyerName: string, contactPhone: string, expiryDays: number }} order */
export const kaluppaNewOrder = (order) => ({
  subject: `New order ${order.orderNumber} · ${peso(order.totalCentavos)}`,
  ...renderLayout({
    preheader: `${order.buyerName} placed ${order.orderNumber}.`,
    heading: `New order ${order.orderNumber}`,
    paragraphs: [
      `${order.buyerName} · ${order.contactPhone}`,
      `${order.method === 'delivery' ? 'Delivery to' : 'Pickup at Kaluppa'}: ${order.destination}`,
      order.paymentMethod === 'e_wallet' ? `${order.provider} · receipt uploaded, please verify it` : `Cash on ${order.method === 'delivery' ? 'delivery' : 'pickup'}`,
      ...itemLines(order),
      ...totalLines(order),
    ],
    cta: { label: 'Open the order', url: order.url },
    footnote: `Confirm or reject it within ${order.expiryDays} days, or it expires automatically.`,
  }),
});
