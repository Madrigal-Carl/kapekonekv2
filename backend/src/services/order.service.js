import { env } from '../config/env.js';
import { getValkey } from '../config/valkey.js';
import { ORDER_GROUPS, ORDER_STATUSES } from '../constants/orderStatus.js';
import { EMAIL_JOBS } from '../queues/email.jobs.js';
import { enqueueEmail } from '../queues/email.queue.js';
import { clearCartItems } from '../repositories/cart.repository.js';
import { countByStatusForBuyer, createOrder, findOrderById, listByBuyerCursor, listOrdersPage } from '../repositories/order.repository.js';
import { findCustomer, updateContactNumber } from '../repositories/user.repository.js';
import { realtime } from '../sockets/realtime.js';
import { AppError } from '../utils/AppError.js';
import { etaWindow } from '../utils/businessDays.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { withLock } from '../utils/lock.js';
import { nextOrderNumber } from '../utils/orderNumber.js';
import { getOwnAddress } from './address.service.js';
import { getCart } from './cart.service.js';
import { quoteForAddress } from './deliveryQuote.service.js';
import { notifyKaluppa, notifyUsers } from './notification.service.js';
import { userCan } from './permission.service.js';
import { getPickup, getSetting } from './setting.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });
const notFound = () => new AppError(404, "We couldn't find that order.");
const fullName = (user) => `${user.firstName} ${user.lastName}`;

/** "Home, Lot 12, Purok 3, Balanacan, Mogpog, Marinduque 4901" or "Kaluppa, Pantayin, Santa Cruz, Marinduque". */
export function destinationText({ fulfillment }) {
  if (fulfillment.method === 'pickup') return `${fulfillment.pickup.name}, ${fulfillment.pickup.address}`;
  const a = fulfillment.address;
  return `${a.label === 'Other' ? a.customLabel : a.label}, ${a.street}, ${a.barangay}, ${a.municipality}, Marinduque ${a.postalCode}`;
}

/** The order plus `eta`: the confirmed window, or (while pending) the window as if confirmed now. */
const withEta = (order, etaDays, now) => {
  const { etaFrom, etaTo } = order.fulfillment;
  const eta = etaFrom ? { from: etaFrom, to: etaTo } : order.status === 'pending' ? etaWindow(now, etaDays) : null;
  return { ...order, eta };
};

export const presentOrder = async (order, now = new Date()) => withEta(order, await getSetting('delivery.eta'), now);

/** What the order emails need (templates/email/orderFormat.js `OrderEmail`). */
export const orderEmailData = (order, eta) => ({
  orderNumber: order.orderNumber,
  url: `${env.CLIENT_URL}/orders/${order._id}`,
  status: order.status,
  items: order.items.map(({ name, quantity, unit, lineTotalCentavos }) => ({ name, quantity, unit, lineTotalCentavos })),
  subtotalCentavos: order.subtotalCentavos,
  deliveryFeeCentavos: order.deliveryFeeCentavos,
  totalCentavos: order.totalCentavos,
  method: order.fulfillment.method,
  destination: destinationText(order),
  paymentMethod: order.payment.method,
  provider: order.payment.provider,
  eta,
  expiryDays: env.ORDER_EXPIRY_DAYS,
});

/** E-wallet receipts must be the buyer's own Cloudinary upload. */
async function receiptFor(user, { paymentMethod, receipt }, now) {
  if (paymentMethod !== 'e_wallet') return {};
  if (!isOwnUpload(user, 'receipt', receipt)) throw fieldError('receipt', 'Upload your receipt again, then place the order.');
  await assertUploadAllowed('receipt', receipt.publicId, 'receipt');
  return { receipt, submittedAt: now };
}

async function deliveryFor(user, addressId) {
  const address = await getOwnAddress(user, addressId);
  const quote = await quoteForAddress(address);
  const { label, customLabel, recipientName, phone, province, municipality, barangay, street, postalCode, location } = address;
  return {
    feeCentavos: quote.feeCentavos,
    fulfillment: {
      method: 'delivery',
      contactName: recipientName,
      contactPhone: phone,
      address: { label, customLabel, recipientName, phone, province, municipality, barangay, street, postalCode, location },
      distanceKm: quote.distanceKm,
      distanceSource: quote.distanceSource,
    },
  };
}

async function pickupFor(user, contactPhone) {
  const phone = contactPhone ?? user.contactNumber;
  if (!phone) throw fieldError('contactPhone', 'Enter a contact number so Kaluppa can reach you about your pickup');
  if (phone !== user.contactNumber) await updateContactNumber(user._id, phone);
  return { feeCentavos: 0, fulfillment: { method: 'pickup', contactName: fullName(user), contactPhone: phone, pickup: await getPickup() } };
}

/** Emails, notifications and the live update after a successful placement. Failures are logged, never undo the order. */
async function announcePlaced(user, order) {
  const eta = (await presentOrder(order)).eta;
  const data = orderEmailData(order, eta);
  try {
    await enqueueEmail(EMAIL_JOBS.ORDER_PLACED, { ...data, to: user.email, name: user.firstName });
    await enqueueEmail(EMAIL_JOBS.KALUPPA_NEW_ORDER, { ...data, to: env.KALUPPA_ORDERS_EMAIL, buyerName: fullName(user), contactPhone: order.fulfillment.contactPhone });
  } catch (error) {
    console.error(`[orders] could not queue emails for ${order.orderNumber}: ${error.message}`);
  }
  const link = `/orders/${order._id}`;
  const ids = { orderId: order._id, orderNumber: order.orderNumber, status: order.status };
  await notifyUsers([user._id], { type: 'order_status', title: `Order ${order.orderNumber} placed`, body: `Kaluppa will confirm it within ${env.ORDER_EXPIRY_DAYS} days.`, link, data: ids });
  await notifyKaluppa({ type: 'order_new', title: `New order ${order.orderNumber}`, body: `${fullName(user)} · ${destinationText(order)}`, link, data: ids });
  realtime.toUser(user._id, 'order:updated', { orderId: order._id, status: order.status });
}

async function createFromCart(user, body) {
  const now = new Date();
  const cart = await getCart(user);
  if (!cart.lines.length) throw new AppError(409, 'Your cart is empty.');
  const blocked = cart.lines.filter((line) => line.flags.length);
  if (blocked.length) {
    throw new AppError(409, `Some items can't be ordered right now: ${blocked.map((l) => l.product.name).join(', ')}. Update your cart and try again.`);
  }
  const payment = { method: body.paymentMethod, provider: body.provider ?? null, ...(await receiptFor(user, body, now)) };
  const { feeCentavos, fulfillment } = body.method === 'delivery' ? await deliveryFor(user, body.addressId) : await pickupFor(user, body.contactPhone);

  const order = await createOrder({
    orderNumber: await nextOrderNumber(now),
    buyer: user._id,
    items: cart.lines.map(({ product, quantity, lineTotalCentavos }) => ({
      product: product._id, name: product.name, slug: product.slug, image: product.image, variety: product.variety, coffeeType: product.coffeeType,
      unit: product.unit, unitLabel: product.unitLabel, priceCentavos: product.priceCentavos, quantity, lineTotalCentavos,
    })),
    subtotalCentavos: cart.subtotalCentavos,
    deliveryFeeCentavos: feeCentavos,
    totalCentavos: cart.subtotalCentavos + feeCentavos,
    fulfillment,
    payment,
    note: body.note || null,
    status: 'pending',
    statusHistory: [{ status: 'pending', at: now, by: user._id, byRole: 'buyer' }],
  });
  await clearCartItems(user._id);
  await announcePlaced(user, order);
  return presentOrder(order, now);
}

/**
 * Place the buyer's cart as a pending order (PRODUCT-SPEC §3 "Placing an order").
 * One placement per buyer at a time; the fee is always recomputed here.
 * @param {object} user req.user
 * @param {{ method: 'delivery'|'pickup', addressId?: string, contactPhone?: string, paymentMethod: 'e_wallet'|'cash', provider?: string, receipt?: { url: string, publicId: string }, note?: string }} body
 */
export async function placeOrder(user, body) {
  const outcome = await withLock(getValkey(), `lock:checkout:${user._id}`, 30_000, () => createFromCart(user, body));
  if (!outcome.acquired) throw new AppError(409, 'Your order is already being placed.');
  return outcome.result;
}

/** The order's customer as the dashboard shows it (null for a deleted account). */
const customerOf = (user) =>
  user ? { id: user._id, name: fullName(user), role: user.roles.includes('farmer') ? 'farmer' : 'buyer', phone: user.contactNumber ?? null } : null;

/**
 * A numbered page of orders for a dashboard table: `scope` limits whose orders (the farmer's own, or Kaluppa's filters),
 * `group` is a Status dropdown group, `q` matches the order number, an item name, or any of `orIds` as the customer.
 * @param {object} scope
 * @param {{ group: string, q: string, page: number, limit: number }} query
 * @param {unknown[]} [orIds] customers whose name matched `q`
 */
export async function listOrderTable(scope, { group, q, page, limit }, orIds = []) {
  const filter = { ...scope };
  if (group !== 'all') filter.status = { $in: ORDER_GROUPS[group] };
  if (q) {
    const pattern = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ orderNumber: pattern }, { 'items.name': pattern }, ...(orIds.length ? [{ buyer: { $in: orIds } }] : [])];
  }
  const result = await listOrdersPage(filter, { page, limit });
  const etaDays = await getSetting('delivery.eta');
  const now = new Date();
  return { items: result.items.map((o) => withEta({ ...o, buyer: o.buyer?._id ?? null, customer: customerOf(o.buyer) }, etaDays, now)), meta: result.meta };
}

/**
 * The user's own orders: by cursor (buyer pages), or numbered pages when `page` is sent (the farmer's dashboard table).
 * @param {{ _id: unknown }} user
 * @param {{ status: string[], cursor?: string, limit: number, page?: number, group: string, q: string }} query
 */
export async function listMyOrders(user, { status, cursor, limit, page: pageNumber, group, q }) {
  if (pageNumber) return listOrderTable({ buyer: user._id }, { group, q, page: pageNumber, limit });
  const page = await listByBuyerCursor(user._id, { statuses: status, cursor, limit });
  const etaDays = await getSetting('delivery.eta');
  const now = new Date();
  return { items: page.items.map((o) => withEta(o, etaDays, now)), meta: page.meta };
}

/** @returns {Promise<Record<string, number>>} every status, zero when none */
export async function countMyOrders(user) {
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
  for (const { _id, n } of await countByStatusForBuyer(user._id)) counts[_id] = n;
  return counts;
}

/** The raw order if the user owns it or manages orders, else 404 (never 403, so ids don't leak). */
export async function findOrderFor(user, id) {
  const order = await findOrderById(id);
  if (!order) throw notFound();
  if (String(order.buyer) !== String(user._id) && !(await userCan(user, 'orders.manage'))) throw notFound();
  return order;
}

/** The order; Kaluppa (orders.manage) also gets the customer for the manage drawer. */
export async function getOrderFor(user, id) {
  const order = await presentOrder(await findOrderFor(user, id));
  if (!(await userCan(user, 'orders.manage'))) return order;
  return { ...order, customer: customerOf(await findCustomer(order.buyer)) };
}
