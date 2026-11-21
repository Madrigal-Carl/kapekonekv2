// Text helpers shared by the order emails. Everything returned is plain text; layout.js escapes it.
const pesoFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const dayFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });

export const peso = (centavos) => pesoFormat.format(centavos / 100);
export const shortDate = (date) => dayFormat.format(new Date(date));

const UNIT = { kg: 'kg', pack: 'pack', piece: 'pc' };
export const quantityText = ({ quantity, unit }) => (unit === 'kg' ? `${quantity} kg` : `${quantity} ${UNIT[unit] ?? unit}${quantity === 1 ? '' : 's'}`);

/**
 * The data every order email carries (built by order.service `orderEmailData`).
 * @typedef {{ to: string, name: string, orderNumber: string, url: string, status?: string,
 *   items: Array<{ name: string, quantity: number, unit: string, lineTotalCentavos: number }>,
 *   subtotalCentavos: number, deliveryFeeCentavos: number, totalCentavos: number,
 *   method: 'delivery'|'pickup', destination: string, paymentMethod: 'e_wallet'|'cash', provider: string|null,
 *   eta: { from: string, to: string } | null }} OrderEmail
 */

/** @param {OrderEmail} order */
export const itemLines = (order) => order.items.map((it) => `${quantityText(it)} × ${it.name} — ${peso(it.lineTotalCentavos)}`);

/** @param {OrderEmail} order */
export const totalLines = (order) => [
  `Subtotal: ${peso(order.subtotalCentavos)}`,
  order.method === 'delivery' ? `Delivery fee: ${peso(order.deliveryFeeCentavos)}` : 'Pickup at Kaluppa: free',
  `Total: ${peso(order.totalCentavos)}`,
];

/** @param {OrderEmail} order */
export const paymentText = (order) => {
  if (order.paymentMethod === 'e_wallet') return `Paid by ${order.provider}. Kaluppa checks your receipt when confirming the order.`;
  return order.method === 'delivery'
    ? `Cash on delivery: please prepare ${peso(order.totalCentavos)} for the rider.`
    : `Cash on pickup: pay ${peso(order.totalCentavos)} at Kaluppa when you collect your order.`;
};

/** @param {OrderEmail} order */
export const etaText = (order) =>
  order.eta ? `${order.method === 'delivery' ? 'Estimated delivery' : 'Ready for pickup'}: ${shortDate(order.eta.from)} – ${shortDate(order.eta.to)}` : null;
