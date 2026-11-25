import { format } from 'date-fns'
import { paymentLabel, riderText } from '@/constants/orderStatus'
import { addressLabel } from '@/lib/address'
import { formatPesoShort, formatPhone, quantityShort } from '@/lib/format'

// Text for the order tables and drawers (OrdersFarmer / OrdersKaluppa .dc.html).

const day = (value) => format(new Date(value), 'MMM d')
export const isPickup = (order) => order.fulfillment.method === 'pickup'

export const stamp = (value) => format(new Date(value), 'MMM d, h:mm a')

/** "2 items · ₱2,690" */
export const orderTitle = (order) => `${order.items.length} ${order.items.length === 1 ? 'item' : 'items'} · ${formatPesoShort(order.totalCentavos)}`

/** "Complete fertilizer 14-14-14 × 2, Organic fertilizer × 1" (kg lines read "Liberica Green Beans 1 kg"). */
export const itemsText = (order) =>
  order.items.map((i) => (i.unit === 'kg' ? `${i.name} ${quantityShort(i.quantity, i.unit)}` : `${i.name} × ${i.quantity}`)).join(', ')

/** "Delivery · Farm, Santa Cruz" / "Pickup at Kaluppa" */
export const methodText = (order) =>
  isPickup(order) ? 'Pickup at Kaluppa' : `Delivery · ${addressLabel(order.fulfillment.address)}, ${order.fulfillment.address.municipality}`

/** Where the order goes: the saved address copy, or the branch it was placed against. */
export function destination(order, { forKaluppa = false } = {}) {
  const f = order.fulfillment
  if (isPickup(order)) {
    const area = (f.pickup?.address ?? '').replace(/, Marinduque$/, '')
    return { title: 'Pickup at Kaluppa', text: forKaluppa ? `Customer picks up in ${area}` : [area, f.pickup?.hours].filter(Boolean).join(' · ') }
  }
  const a = f.address
  const eta = order.eta ? ` · ETA ${day(order.eta.from)} – ${day(order.eta.to)}` : ''
  return {
    title: `Deliver to ${addressLabel(a)}`,
    text: forKaluppa
      ? `${a.recipientName} · ${f.distanceKm} km by road${eta}`
      : `${a.recipientName} · ${formatPhone(a.phone)} · ${[a.street, a.barangay, a.municipality].filter(Boolean).join(', ')} ${a.postalCode ?? ''}`.trim(),
  }
}

/** How it's paid, for the farmer's view. */
export function paymentBox(order) {
  if (order.payment.method === 'cash') return { title: paymentLabel(order), text: `Pay ${formatPesoShort(order.totalCentavos)} when you receive it.` }
  const { refund, payment } = order
  if (refund?.status === 'refunded') return { title: payment.provider, text: `Refunded · Ref ${refund.referenceNumber}` }
  if (refund?.status === 'pending') return { title: payment.provider, text: 'Refund pending. Kaluppa sends it back to your e-wallet.' }
  return { title: payment.provider, text: payment.verifiedAt ? `Receipt verified ${day(payment.verifiedAt)}` : 'Receipt sent · Kaluppa checks it when confirming' }
}

/** The farmer's status banner at the top of the view drawer. */
export function farmerBanner(order) {
  const etaLine = order.eta ? `Estimated delivery ${day(order.eta.from)} – ${day(order.eta.to)}.` : 'Kaluppa is preparing it.'
  const f = order.fulfillment
  switch (order.status) {
    case 'pending': return { tone: 'amber', title: 'Waiting for Kaluppa to confirm', text: 'Kaluppa confirms within 3 days or the order expires.' }
    case 'out_for_delivery':
      return { tone: 'roast', title: 'Out for delivery', text: [riderText(f.rider), order.payment.method === 'cash' && `Prepare ${formatPesoShort(order.totalCentavos)} in cash.`].filter(Boolean).join('. ') || 'On its way to you.' }
    case 'ready_for_pickup': return { tone: 'roast', title: 'Ready for pickup', text: `Pick it up at ${f.pickup?.name ?? 'Kaluppa'}, ${f.pickup?.address ?? ''}. ${f.pickup?.hours ?? ''}`.trim() }
    case 'sold': {
      const at = order.statusHistory?.findLast((h) => h.status === 'sold')?.at ?? order.updatedAt
      return { tone: 'green', title: `Completed on ${day(at)}`, text: `${isPickup(order) ? 'Picked up at Kaluppa' : 'Delivered'}. You can review the product from the store.` }
    }
    case 'cancelled': return { tone: 'gray', title: 'Cancelled', text: order.cancellation?.reason ?? 'This order was cancelled.' }
    case 'rejected': return { tone: 'red', title: 'Rejected by Kaluppa', text: order.rejection?.reason ?? 'Kaluppa could not accept this order.' }
    case 'expired': return { tone: 'gray', title: 'Expired', text: 'Kaluppa didn’t confirm it within 3 days.' }
    default: return { tone: 'blue', title: 'Being prepared', text: isPickup(order) ? 'Kaluppa tells you when it’s ready for pickup.' : etaLine }
  }
}

