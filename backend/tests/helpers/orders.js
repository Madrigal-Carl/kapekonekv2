// Orders created straight in Mongo, in any status, for status-machine and expiry tests.
import { Order, User } from '../../src/models/index.js';

let seq = 0;

/**
 * @param {Record<string, object>} products fixture products by slug
 * @param {{ email?: string, status?: string, method?: 'delivery'|'pickup', paymentMethod?: 'cash'|'e_wallet', items?: Array<[string, number]>, createdAt?: Date, stockReserved?: boolean }} [options]
 */
export async function makeOrder(products, { email = 'buyer@kapekonek.test', status = 'pending', method = 'delivery', paymentMethod = 'cash', items = [['barako-medium-roast', 2]], createdAt = new Date(), stockReserved } = {}) {
  const buyer = await User.findOne({ email });
  seq += 1;
  const lines = items.map(([slug, quantity]) => {
    const p = products[slug];
    return { product: p._id, name: p.name, slug, unit: p.unit, priceCentavos: p.priceCentavos, quantity, lineTotalCentavos: Math.round(p.priceCentavos * quantity) };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotalCentavos, 0);
  const fee = method === 'delivery' ? 29000 : 0;
  return (await Order.create({
    orderNumber: `KK-20261120-${String(seq).padStart(4, '0')}`,
    buyer: buyer._id,
    items: lines,
    subtotalCentavos: subtotal,
    deliveryFeeCentavos: fee,
    totalCentavos: subtotal + fee,
    fulfillment: method === 'delivery'
      ? { method, contactName: 'Juana Dela Cruz', contactPhone: '09171234567', address: { label: 'Home', recipientName: 'Juana Dela Cruz', phone: '09171234567', province: 'Marinduque', municipality: 'Mogpog', barangay: 'Balanacan', street: 'Lot 12, Purok 3', postalCode: '4901' }, distanceKm: 26.8, distanceSource: 'mapbox' }
      : { method, contactName: 'Juana Dela Cruz', contactPhone: '09171234567', pickup: { name: 'Kaluppa', address: 'Pantayin, Santa Cruz, Marinduque', hours: 'Mon–Sat, 8 AM–5 PM' } },
    payment: paymentMethod === 'e_wallet'
      ? { method: paymentMethod, provider: 'GCash', receipt: { url: 'https://res.cloudinary.com/test/r.jpg', publicId: 'kapekonek/receipts/x/r' }, submittedAt: createdAt }
      : { method: paymentMethod },
    status,
    stockReserved: stockReserved ?? ['reserved', 'processing', 'out_for_delivery', 'ready_for_pickup'].includes(status),
    statusHistory: [{ status: 'pending', at: createdAt, by: buyer._id, byRole: 'buyer' }],
    createdAt,
  })).toObject();
}
