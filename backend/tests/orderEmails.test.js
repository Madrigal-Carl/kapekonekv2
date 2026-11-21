import { describe, expect, it } from 'vitest';
import { kaluppaNewOrder } from '../src/templates/email/kaluppaNewOrder.template.js';
import { orderPlaced } from '../src/templates/email/orderPlaced.template.js';

const order = {
  to: 'buyer@kapekonek.test',
  name: 'Juana <b>',
  orderNumber: 'KK-20261121-0007',
  url: 'http://localhost:5173/orders/abc',
  items: [
    { name: 'Barako Medium Roast', quantity: 2, unit: 'pack', lineTotalCentavos: 52000 },
    { name: 'Liberica Green Beans', quantity: 1.5, unit: 'kg', lineTotalCentavos: 48000 },
  ],
  subtotalCentavos: 100000,
  deliveryFeeCentavos: 29000,
  totalCentavos: 129000,
  method: 'delivery',
  destination: 'Home, Lot 12, Purok 3, Balanacan, Mogpog, Marinduque 4901',
  paymentMethod: 'cash',
  provider: null,
  eta: { from: '2026-11-25T04:00:00.000Z', to: '2026-11-27T04:00:00.000Z' },
  expiryDays: 3,
};

describe('order emails', () => {
  it('ORDER_PLACED lists items, totals, cash note and the ETA, with user text escaped', () => {
    const { subject, html, text } = orderPlaced(order);
    expect(subject).toBe('We received your order KK-20261121-0007');
    expect(text).toContain('2 packs × Barako Medium Roast — ₱520.00');
    expect(text).toContain('1.5 kg × Liberica Green Beans — ₱480.00');
    expect(text).toContain('Delivery fee: ₱290.00');
    expect(text).toContain('Cash on delivery: please prepare ₱1,290.00 for the rider.');
    expect(text).toContain('Estimated delivery: Nov 25 – Nov 27');
    expect(html).toContain('Juana &lt;b&gt;');
    expect(html).not.toContain('Juana <b>');
  });

  it('KALUPPA_NEW_ORDER names the buyer and the e-wallet to verify', () => {
    const { subject, text } = kaluppaNewOrder({ ...order, method: 'pickup', paymentMethod: 'e_wallet', provider: 'GCash', buyerName: 'Juana Dela Cruz', contactPhone: '09171234567', destination: 'Kaluppa, Pantayin, Santa Cruz, Marinduque' });
    expect(subject).toBe('New order KK-20261121-0007 · ₱1,290.00');
    expect(text).toContain('Juana Dela Cruz · 09171234567');
    expect(text).toContain('GCash · receipt uploaded, please verify it');
    expect(text).toContain('Pickup at Kaluppa: free');
  });
});
