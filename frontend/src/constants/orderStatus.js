import { format } from 'date-fns'
import { IconCircleCheck, IconCircleX, IconClock, IconList, IconPackage, IconTruck } from '@/components/ui/icons'

import { addressLabel } from '@/lib/address'
import { formatPhone } from '@/lib/format'

/** Label and colour classes per order status (DESIGN.md "Order status colors"). */
export const ORDER_STATUS = {
  pending: { label: 'Pending', pill: 'bg-st-pending-bg text-st-pending-ink', dot: 'bg-st-pending-dot' },
  reserved: { label: 'Reserved', pill: 'bg-st-reserved-bg text-st-reserved-ink', dot: 'bg-st-reserved-dot' },
  processing: { label: 'Processing', pill: 'bg-st-processing-bg text-st-processing-ink', dot: 'bg-st-processing-dot' },
  out_for_delivery: { label: 'Out for delivery', pill: 'bg-st-transit-bg text-st-transit-ink', dot: 'bg-st-transit-dot' },
  ready_for_pickup: { label: 'Ready for pickup', pill: 'bg-st-transit-bg text-st-transit-ink', dot: 'bg-st-transit-dot' },
  sold: { label: 'Sold', pill: 'bg-st-sold-bg text-st-sold-ink', dot: 'bg-st-sold-dot' },
  cancelled: { label: 'Cancelled', pill: 'bg-st-cancelled-bg text-st-cancelled-ink', dot: 'bg-st-cancelled-dot' },
  rejected: { label: 'Rejected', pill: 'bg-st-rejected-bg text-st-rejected-ink', dot: 'bg-st-rejected-dot' },
  expired: { label: 'Expired', pill: 'bg-st-expired-bg text-st-expired-ink', dot: 'bg-st-expired-dot' },
}

/** The six group cards on /orders (DESIGN.md `OrderGroupTabs`). `statuses: null` means every order. */
export const ORDER_GROUPS = [
  { key: 'all', label: 'All orders', hint: 'Every order you’ve placed', statuses: null, icon: IconList },
  { key: 'to_confirm', label: 'To confirm', hint: 'Waiting for Kaluppa', statuses: ['pending'], icon: IconClock },
  { key: 'preparing', label: 'Preparing', hint: 'Confirmed and being packed', statuses: ['reserved', 'processing'], icon: IconPackage },
  { key: 'on_the_way', label: 'On the way', hint: 'Out for delivery or ready to pick up', statuses: ['out_for_delivery', 'ready_for_pickup'], icon: IconTruck },
  { key: 'completed', label: 'Completed', hint: 'Delivered or picked up', statuses: ['sold'], icon: IconCircleCheck },
  { key: 'closed', label: 'Closed', hint: 'Cancelled, rejected or expired', statuses: ['cancelled', 'rejected', 'expired'], icon: IconCircleX },
]

/** Sum of the counts for a group's statuses (`null` → all). */
export const groupCount = (statuses, counts = {}) =>
  (statuses ?? Object.keys(ORDER_STATUS)).reduce((sum, s) => sum + (counts[s] ?? 0), 0)

/** Same codes and labels as the backend's BUYER_CANCEL_REASONS. */
export const CANCEL_REASONS = [
  { code: 'change_delivery_address', label: 'Need to change the delivery address' },
  { code: 'change_items', label: 'Want to change items or quantity' },
  { code: 'wrong_receipt', label: 'Uploaded the wrong receipt' },
  { code: 'ordered_by_mistake', label: 'Ordered by mistake' },
  { code: 'other', label: 'Other' },
]

/** "Cash on delivery" / "Cash on pickup" / "GCash". */
export const paymentLabel = (order) =>
  order.payment.method === 'cash' ? (order.fulfillment.method === 'delivery' ? 'Cash on delivery' : 'Cash on pickup') : order.payment.provider

/** Refund badge text, or null when there's nothing to show. */
export function refundLabel(refund) {
  if (refund?.status === 'pending') return 'Refund pending'
  if (refund?.status === 'refunded') return `Refunded · Ref ${refund.referenceNumber}`
  return null
}

const PATHS = {
  delivery: ['pending', 'reserved', 'processing', 'out_for_delivery', 'sold'],
  pickup: ['pending', 'reserved', 'processing', 'ready_for_pickup', 'sold'],
}

const UPCOMING = {
  reserved: 'When Kaluppa confirms your order',
  processing: 'When Kaluppa starts preparing it',
  out_for_delivery: 'When the rider leaves Kaluppa',
  ready_for_pickup: 'When it’s ready at Kaluppa',
}

/** "Rider: Jun R. · 0917 555 0102", or null when no rider is recorded. */
export const riderText = (rider) => (rider?.name ? `Rider: ${rider.name} · ${formatPhone(rider.phone)}` : null)

function doneText(entry, order) {
  const delivery = order.fulfillment.method === 'delivery'
  switch (entry.status) {
    case 'pending': return `by you · ${paymentLabel(order)}`
    case 'reserved': return 'Kaluppa confirmed your order'
    case 'processing': return 'Kaluppa is preparing your order'
    case 'out_for_delivery': return riderText(order.fulfillment.rider) ?? entry.note ?? 'Your order left Kaluppa'
    case 'ready_for_pickup': return 'Ready at Kaluppa'
    case 'sold': return delivery ? 'Delivered and paid' : 'Picked up and paid'
    case 'cancelled': return `by you · ${entry.reason ?? 'Cancelled'}`
    case 'rejected': return `by Kaluppa · ${entry.reason ?? 'Rejected'}`
    case 'expired': return 'Kaluppa didn’t confirm it in time'
    default: return ''
  }
}

/**
 * Timeline rows for an order: its history (done), then the steps still to come on its path.
 * The latest history entry is `current` unless the order is finished.
 */
export function timelineSteps(order) {
  const history = order.statusHistory ?? []
  const last = history.at(-1)?.status ?? order.status
  const done = history.map((entry, i) => ({
    key: `${entry.status}-${i}`,
    title: entry.status === 'pending' ? 'Order placed' : ORDER_STATUS[entry.status].label,
    meta: `${format(new Date(entry.at), 'MMM d, h:mm a')} · ${doneText(entry, order)}`,
    done: true,
    current: i === history.length - 1 && last !== 'sold' && !['cancelled', 'rejected', 'expired'].includes(last),
  }))
  const path = PATHS[order.fulfillment.method]
  if (!path.includes(last)) return done
  const delivery = order.fulfillment.method === 'delivery'
  const upcoming = path.slice(path.indexOf(last) + 1).map((status) => ({
    key: status,
    title: ORDER_STATUS[status].label,
    meta: status === 'sold' ? (delivery ? 'When it’s delivered and paid' : 'When you pick it up and pay') : UPCOMING[status],
    done: false,
    current: false,
  }))
  return [...done, ...upcoming]
}

/** "Delivery · Home, Balanacan, Mogpog" / "Pickup · Kaluppa, Pantayin, Santa Cruz". */
export function destinationLine({ fulfillment: f }) {
  if (f.method === 'delivery') return `Delivery · ${addressLabel(f.address)}, ${f.address.barangay}, ${f.address.municipality}`
  return `Pickup · ${f.pickup?.name ?? 'Kaluppa'}, ${(f.pickup?.address ?? '').replace(/, Marinduque$/, '')}`
}

/** Status pills in the dashboard tables and drawers (OrdersFarmer / OrdersKaluppa.dc.html). */
export const DASH_ORDER_STATUS = {
  pending: { label: 'To confirm', tone: 'amber' },
  reserved: { label: 'Confirmed', tone: 'blue' },
  processing: { label: 'Processing', tone: 'blue' },
  out_for_delivery: { label: 'Out for delivery', tone: 'roast' },
  ready_for_pickup: { label: 'Ready for pickup', tone: 'roast' },
  sold: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  rejected: { label: 'Rejected', tone: 'red' },
  expired: { label: 'Expired', tone: 'gray' },
}

/** The Status dropdown: the order groups, "All orders" first for farmers, last for Kaluppa (whose default is To confirm). */
export const orderStatusFilter = (allFirst) => {
  const groups = ORDER_GROUPS.map((g) => ({ value: g.key === 'all' ? '' : g.key, label: g.label }))
  return { label: 'Status', options: allFirst ? groups : [...groups.slice(1), { value: 'all', label: 'All orders' }] }
}

/** The Payment pill: cash, a receipt still to check, verified, or the refund. */
export function paymentPill(order) {
  if (order.payment.method === 'cash') return { label: paymentLabel(order), tone: 'gray' }
  if (order.refund?.status === 'pending') return { label: 'Refund pending', tone: 'red' }
  if (order.refund?.status === 'refunded') return { label: 'Refunded', tone: 'gray' }
  if (order.status === 'pending') return { label: `${order.payment.provider} · check receipt`, tone: 'amber' }
  return { label: `${order.payment.provider} · verified`, tone: 'green' }
}
