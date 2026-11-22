import { SETTING_DEFAULTS } from '../../constants/settings.js';
import { ROLES } from '../../constants/permissions.js';
import { listActiveByUser } from '../../repositories/address.repository.js';
import { insertNotifications } from '../../repositories/notification.repository.js';
import { getSetting } from '../../services/setting.service.js';
import { buildBuyerOrders, noticesFor } from './buyerOrders.js';
import { countOrders, insertOrders } from '../../repositories/order.repository.js';
import { addSoldCount, listProductsByCategoryIds, reserveStock } from '../../repositories/product.repository.js';
import { insertReviews } from '../../repositories/review.repository.js';
import { findUserIdsByRole, findUsersByUsernames } from '../../repositories/user.repository.js';
import { categoryIdsBySlug } from '../../repositories/category.repository.js';
import { getLocations } from '../../services/location.service.js';
import { recomputeRating } from '../../services/review.service.js';
import { feeForDistance } from '../../utils/deliveryFee.js';
import { nextOrderNumber } from '../../utils/orderNumber.js';

const DAY = 86_400_000;
const FEE = SETTING_DEFAULTS['delivery.fee'];
const PICKUP = SETTING_DEFAULTS['pickup.location'];

// [rating, comment]. Never mentions messaging or chat (PRODUCT-SPEC §11).
const REVIEWS = [
  [5, 'Strong, smoky and smooth. Tastes just like the barako my lola used to brew.'],
  [5, 'Fresh roast, arrived well sealed. The aroma filled the whole kitchen.'],
  [4, 'Good body and low acidity. A bit too dark for my taste, but my husband loves it.'],
  [5, 'Best local coffee I have bought this year. Ordering again next month.'],
  [4, 'Arrived in four days, nicely packed. Great with a little muscovado.'],
  [5, 'Rich and chocolatey. Perfect for the French press.'],
  [3, 'Decent cup, though I prefer a lighter roast. Packaging was excellent.'],
  [5, 'Picked it up at Kaluppa on my way home. Staff were friendly and the beans are excellent.'],
  [4, 'Consistent quality from bag to bag. Good value for the price.'],
  [5, 'Our café switched to this and customers keep asking about it.'],
  [5, 'Bold flavour without the bitterness. Happy to support Marinduque farmers.'],
  [4, 'Very fresh. I wish there were a 500 g bag.'],
  [5, 'Smells amazing the moment you open the bag. Great crema in my moka pot.'],
  [4, 'Strong enough for my morning. Delivery fee was fair for Gasan.'],
  [5, 'Second order already. Same great taste as the first one.'],
  [3, 'Good coffee, but the grind was a little coarse for my drip machine.'],
  [5, 'Lovely gift for my parents. They finished the bag in a week.'],
  [4, 'Clean, earthy taste. Works well with milk.'],
];

/** Product slugs bought by extra buyer i (0-based). Barako and Robusta end up with 12+ reviews each. */
const basketFor = (i) => [
  ...(i < 16 ? ['barako-medium-roast'] : []),
  ...(i >= 4 && i < 18 ? ['robusta-dark-roast'] : []),
  ['arabica-light-roast', 'excelsa-ground', 'liberica-green-beans', 'arabica-ground', 'robusta-ground'][i % 5],
];

const historyFor = (method, placedAt, soldAt) => [
  { status: 'pending', at: placedAt, byRole: 'buyer' },
  { status: 'processing', at: new Date(placedAt.getTime() + DAY / 4), byRole: 'kaluppa' },
  { status: method === 'delivery' ? 'out_for_delivery' : 'ready_for_pickup', at: new Date(soldAt.getTime() - DAY / 2), byRole: 'kaluppa' },
  { status: 'sold', at: soldAt, byRole: 'kaluppa' },
];

/**
 * Sold orders and reviews from the extra buyers, so ratings, review lists and "Top rated" have data.
 * Juana (`buyer`) gets one sold order without a review, to try "Write a review".
 * Skipped once any order exists.
 */
export async function seedDemo() {
  if ((await countOrders()) > 0) return 'skipped (orders exist)';
  const ids = await categoryIdsBySlug();
  const products = Object.fromEntries((await listProductsByCategoryIds([ids.coffee])).map((p) => [p.slug, p]));
  if (!products['barako-medium-roast']) throw new Error('Run the products seeder first.');
  const handles = ['buyer', ...Array.from({ length: 20 }, (_, i) => `buyer${String(i + 1).padStart(2, '0')}`)];
  const users = Object.fromEntries((await findUsersByUsernames(handles)).map((u) => [u.username, u]));
  const towns = getLocations();
  const now = Date.now();
  const orders = [];
  const reviews = [];
  const sold = new Map();

  const addOrder = async (buyer, slugs, i) => {
    const method = i % 3 === 0 ? 'pickup' : 'delivery';
    const placedAt = new Date(now - (40 - i) * DAY);
    const soldAt = new Date(placedAt.getTime() + (method === 'delivery' ? 4 : 2) * DAY);
    const items = slugs.map((slug, j) => {
      const p = products[slug];
      const quantity = p.unit === 'kg' ? 1 + (j % 2) * 0.5 : 1 + ((i + j) % 2);
      sold.set(p._id, (sold.get(p._id) ?? 0) + quantity);
      return {
        product: p._id, name: p.name, slug: p.slug, image: p.images[0]?.url, variety: p.variety, coffeeType: p.coffeeType,
        unit: p.unit, unitLabel: p.unitLabel, priceCentavos: p.priceCentavos, quantity, lineTotalCentavos: Math.round(p.priceCentavos * quantity),
      };
    });
    const subtotalCentavos = items.reduce((sum, it) => sum + it.lineTotalCentavos, 0);
    const town = towns[i % towns.length];
    const distanceKm = 4 + ((i * 7) % 30);
    const deliveryFeeCentavos = method === 'delivery' ? feeForDistance(distanceKm, FEE) : 0;
    const contactName = `${buyer.firstName} ${buyer.lastName}`;
    const order = {
      orderNumber: await nextOrderNumber(placedAt),
      buyer: buyer._id,
      items,
      subtotalCentavos,
      deliveryFeeCentavos,
      totalCentavos: subtotalCentavos + deliveryFeeCentavos,
      fulfillment: method === 'delivery'
        ? {
          method, contactName, contactPhone: buyer.contactNumber, distanceKm, distanceSource: 'fallback',
          address: { label: 'home', recipientName: contactName, phone: buyer.contactNumber, province: 'Marinduque', municipality: town.name, barangay: town.barangays[i % town.barangays.length], postalCode: town.postalCode },
          etaFrom: new Date(placedAt.getTime() + 3 * DAY), etaTo: new Date(placedAt.getTime() + 5 * DAY),
        }
        : { method, contactName, contactPhone: buyer.contactNumber, pickup: { name: PICKUP.name, address: PICKUP.address, hours: PICKUP.hours, location: PICKUP.location } },
      payment: i % 2 ? { method: 'e_wallet', provider: i % 4 === 1 ? 'GCash' : 'Maya', submittedAt: placedAt, verifiedAt: new Date(placedAt.getTime() + DAY / 4) } : { method: 'cash', cashCollectedAt: soldAt },
      status: 'sold',
      statusHistory: historyFor(method, placedAt, soldAt),
      createdAt: placedAt,
      updatedAt: soldAt,
    };
    orders.push(order);
    return { order, soldAt };
  };

  for (let i = 0; i < 20; i += 1) {
    const buyer = users[handles[i + 1]];
    const slugs = basketFor(i);
    const { soldAt } = await addOrder(buyer, slugs, i);
    slugs.forEach((slug, j) => {
      const [rating, comment] = REVIEWS[(i * 3 + j) % REVIEWS.length];
      const at = new Date(soldAt.getTime() + (1 + j) * DAY / 2);
      reviews.push({ product: products[slug]._id, buyer: buyer._id, orderIndex: orders.length - 1, rating, comment, createdAt: at, updatedAt: at });
    });
  }
  await addOrder(users.buyer, ['arabica-light-roast'], 20);

  const inserted = await insertOrders(orders);
  await insertReviews(reviews.map(({ orderIndex, ...r }) => ({ ...r, order: inserted[orderIndex]._id })));
  for (const [productId, quantity] of sold) await addSoldCount(productId, quantity);
  for (const productId of new Set(reviews.map((r) => r.product))) await recomputeRating(productId);

  const juana = await seedJuanaOrders(users.buyer, products);
  return `${orders.length} sold orders, ${reviews.length} reviews, ${juana} orders for buyer in every status`;
}

const ADDRESS_KEYS = { Home: 'home', Work: 'work', Other: 'mama' };

/** Juana's orders across all statuses, with notifications; reserved stock and sales are applied to the products. */
async function seedJuanaOrders(buyer, products) {
  const addresses = Object.fromEntries((await listActiveByUser(buyer._id)).map((a) => [ADDRESS_KEYS[a.label], a]));
  if (!addresses.home || !addresses.work || !addresses.mama) throw new Error('Run the addresses seeder first.');
  const [kaluppaId] = await findUserIdsByRole(ROLES.KALUPPA);
  const [fee, eta, pickup] = await Promise.all([getSetting('delivery.fee'), getSetting('delivery.eta'), getSetting('pickup.location')]);
  const { orders, reserved, sold } = await buildBuyerOrders({ buyer, kaluppaId, addresses, products, fee, eta, pickup });
  const inserted = (await insertOrders(orders)).map((o) => o.toObject());
  const kaluppaNotices = inserted.filter((o) => o.status === 'pending').map((o) => ({
    user: kaluppaId, type: 'order_new', title: `New order ${o.orderNumber}`, body: `${buyer.firstName} ${buyer.lastName}`, link: `/orders/${o._id}`,
    data: { orderId: o._id, orderNumber: o.orderNumber, status: o.status }, createdAt: o.createdAt,
  }));
  await insertNotifications([...noticesFor(inserted), ...kaluppaNotices]);
  for (const [productId, quantity] of reserved) await reserveStock(productId, quantity);
  for (const [productId, quantity] of sold) await addSoldCount(productId, quantity);
  return inserted.length;
}
