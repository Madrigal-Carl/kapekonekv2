import { format } from 'date-fns'
import { Banknote, CircleCheck, CircleX, Clock, MapPin, Package, PackageCheck, Store, Truck, TriangleAlert, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LabelChip } from '@/components/map/AddressCard'
import { CancelOrderDialog } from '@/components/order/CancelOrderDialog'
import { RefundBadge, StatusPill } from '@/components/order/StatusPill'
import { StatusTimeline } from '@/components/order/StatusTimeline'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { productMeta } from '@/constants/catalog'
import { ORDER_STATUS, paymentLabel, riderText, timelineSteps } from '@/constants/orderStatus'
import { useOrder } from '@/hooks/useOrders'
import { addressLabel, addressLine } from '@/lib/address'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/date'
import { formatPeso, formatPhone } from '@/lib/format'

const CLOSED = ['cancelled', 'rejected', 'expired']
const shortDate = (d) => format(new Date(d), 'MMM d')
const card = 'rounded-card border border-sand bg-white px-5 py-[18px]'
const cardTitle = 'text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3'

function refundText(order) {
  const { refund } = order
  if (refund.status === 'pending') return ' Your e-wallet payment will be refunded; Kaluppa adds the reference number here.'
  if (refund.status === 'refunded') return ` Refunded on ${formatDate(refund.refundedAt)} · Ref ${refund.referenceNumber}.`
  return ''
}

/** Headline, detail and icon for the status banner. */
function banner(order) {
  const total = formatPeso(order.totalCentavos)
  const cash = order.payment.method === 'cash'
  const delivery = order.fulfillment.method === 'delivery'
  const reason = (order.cancellation ?? order.rejection)?.reason
  switch (order.status) {
    case 'pending':
      return { icon: Clock, title: 'Waiting for Kaluppa to confirm', text: `Kaluppa confirms within 3 days. If it doesn’t, the order expires${cash ? '' : ' and your payment is refunded'}.` }
    case 'reserved':
      return { icon: PackageCheck, title: 'Kaluppa confirmed your order', text: 'Your coffee is set aside for you.' }
    case 'processing':
      return { icon: Package, title: 'Your order is being prepared', text: delivery ? 'It leaves Kaluppa with a rider soon.' : 'We’ll let you know when it’s ready to pick up.' }
    case 'out_for_delivery':
      return {
        icon: Truck,
        title: 'Your order is on the way',
        text: (
          <>
            {riderText(order.fulfillment.rider) ?? 'A rider from Kaluppa is on the way.'}
            {order.fulfillment.rider && ' (from Kaluppa).'}
            {cash && (
              <>
                {' '}Please prepare <strong>{total}</strong> in cash.
              </>
            )}
          </>
        ),
      }
    case 'ready_for_pickup':
      return {
        icon: Store,
        title: `Ready for pickup at ${order.fulfillment.pickup?.name ?? 'Kaluppa'}`,
        text: (
          <>
            {order.fulfillment.pickup?.hours}.
            {cash && (
              <>
                {' '}Please bring <strong>{total}</strong> in cash.
              </>
            )}
          </>
        ),
      }
    case 'sold':
      return { icon: CircleCheck, title: delivery ? 'Delivered' : 'Picked up', text: 'Thank you for your order. You can now review the coffee you bought.' }
    case 'cancelled':
      return { icon: CircleX, title: 'You cancelled this order', text: `${reason ? `Reason: ${reason}.` : ''}${refundText(order)}` }
    case 'rejected':
      return { icon: CircleX, title: 'Kaluppa couldn’t accept this order', text: `${reason ? `Reason: ${reason}.` : ''}${refundText(order)}` }
    default:
      return { icon: CircleX, title: 'This order expired', text: `Kaluppa didn’t confirm it within 3 days.${refundText(order)}` }
  }
}

function StatusBanner({ order }) {
  const { icon: Icon, title, text } = banner(order)
  const s = ORDER_STATUS[order.status]
  const showEta = order.eta && !['sold', ...CLOSED].includes(order.status)
  return (
    <div role="status" className={cn('mt-[18px] flex flex-wrap items-start gap-3 rounded-card border bg-white px-4 py-3.5', s.dot === 'bg-st-transit-dot' ? 'border-st-transit-line' : 'border-sand')}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-card', s.pill)}>
        <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
      </span>
      <div className="flex-[1_1_320px]">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-ink-2">{text}</p>
      </div>
      {showEta && (
        <div className="text-right max-sm:text-left">
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">{order.fulfillment.method === 'delivery' ? 'Estimated delivery' : 'Ready for pickup'}</span>
          <span className="block text-[15px] font-semibold">
            {shortDate(order.eta.from)} – {shortDate(order.eta.to)}
          </span>
        </div>
      )}
    </div>
  )
}

function DestinationCard({ order }) {
  const f = order.fulfillment
  if (f.method === 'pickup') {
    return (
      <section aria-labelledby="dest-title" className={card}>
        <h2 id="dest-title" className={cardTitle}>Pickup at {f.pickup?.name ?? 'Kaluppa'}</h2>
        <p className="mt-2.5 text-[15px] font-semibold">{f.pickup?.name}</p>
        <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-2">{f.pickup?.address}</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">{f.pickup?.hours}</p>
        <p className="mt-2 text-[12.5px] text-ink-3">
          Contact: {f.contactName} · {formatPhone(f.contactPhone)}
        </p>
      </section>
    )
  }
  const a = f.address
  return (
    <section aria-labelledby="dest-title" className={card}>
      <h2 id="dest-title" className={cardTitle}>Delivery address</h2>
      <p className="mt-2.5 flex flex-wrap items-center gap-2">
        <strong className="text-[15px]">{a.recipientName}</strong>
        <span className="text-[13px] text-ink-3">{formatPhone(a.phone)}</span>
        <LabelChip>{addressLabel(a)}</LabelChip>
      </p>
      <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-2">{addressLine(a)}</p>
      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-3">
        <MapPin aria-hidden="true" className="size-[13px]" strokeWidth={2} />
        {a.location ? 'Pinned on map' : 'No map pin'} · {f.distanceKm} km {f.distanceSource === 'mapbox' ? '' : 'estimated '}from Kaluppa
      </p>
    </section>
  )
}

function PaymentCard({ order }) {
  const p = order.payment
  const cash = p.method === 'cash'
  const delivery = order.fulfillment.method === 'delivery'
  const Icon = cash ? Banknote : Wallet
  let detail
  if (cash) detail = p.cashCollectedAt ? `Paid in cash on ${formatDate(p.cashCollectedAt)}.` : delivery ? 'Pay the rider when your order arrives.' : 'Pay at Kaluppa when you pick it up.'
  else detail = p.verifiedAt ? `Verified by Kaluppa on ${formatDate(p.verifiedAt)}.` : 'Kaluppa checks your receipt before confirming.'
  return (
    <section aria-labelledby="pay-title" className={card}>
      <h2 id="pay-title" className={cardTitle}>Payment</h2>
      <div className="mt-2.5 flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-card bg-crema text-roast">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-sm font-semibold">
            {paymentLabel(order)} · {formatPeso(order.totalCentavos)}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-2">{detail}</p>
        </div>
      </div>
      {!cash && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {p.receipt?.url ? (
            <a href={p.receipt.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[12.5px] font-semibold no-underline">
              <img src={p.receipt.url} alt="Your payment receipt" className="size-12 rounded-[6px] border border-sand object-cover" />
              View receipt
            </a>
          ) : (
            <span className="text-[12.5px] text-ink-3">Receipt on file with Kaluppa</span>
          )}
          <RefundBadge refund={order.refund} />
        </div>
      )}
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 pt-7 sm:px-8">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 w-full rounded-card" />
      <Skeleton className="h-48 w-full rounded-card" />
    </div>
  )
}

/** /orders/:id (OrderDetail.dc.html): full width, no side column. */
export function OrderDetail() {
  const { id } = useParams()
  const order = useOrder(id)
  const [cancelling, setCancelling] = useState(false)

  if (order.isPending) return <DetailSkeleton />
  if (order.isError) {
    const missing = order.error?.response?.status === 404
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-12 sm:px-8">
        <EmptyState
          icon={TriangleAlert}
          tone={missing ? 'neutral' : 'error'}
          title={missing ? 'We couldn’t find that order' : 'We couldn’t load this order'}
          action={missing ? <Button to="/orders">Back to my orders</Button> : <Button variant="outline" onClick={() => order.refetch()}>Try again</Button>}
          className="bg-white"
        >
          {missing ? 'It may have been placed from another account.' : 'Check your connection and try again.'}
        </EmptyState>
      </div>
    )
  }

  const o = order.data
  const delivery = o.fulfillment.method === 'delivery'
  const totalLabel = o.payment.method === 'cash' ? (delivery ? 'Total · pay on delivery' : 'Total · pay at pickup') : `Total · paid by ${o.payment.provider}`

  return (
    <>
      <div className="mx-auto max-w-[1280px] px-4 pt-7 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-3">
          <Link to="/orders" className="text-ink-3 no-underline hover:text-roast">
            My orders
          </Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page" className="text-ink">{o.orderNumber}</span>
        </nav>
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3.5">
          <div>
            <h1 className="text-[26px] font-medium tracking-[-0.01em] sm:text-[32px]">{o.orderNumber}</h1>
            <p className="mt-1 text-[13.5px] text-ink-3">
              Placed {formatDateTime(o.createdAt)} · {delivery ? 'Delivery' : 'Pickup'} · {paymentLabel(o)}
            </p>
          </div>
          <StatusPill status={o.status} size="lg" />
        </div>
        <StatusBanner order={o} />
      </div>

      <div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-4 pb-20 pt-6 sm:px-8">
        <section aria-labelledby="items-title" className="overflow-hidden rounded-card border border-sand bg-white">
          <h2 id="items-title" className="border-b border-sand-soft px-5 py-4 text-[15px] font-semibold">
            Items
          </h2>
          <div className="px-5 pb-4 pt-1.5">
            {o.items.map((item) => (
              <div key={item.product} className="flex flex-wrap items-center gap-3.5 border-b border-table-line py-3">
                <span aria-hidden="true" className="size-14 shrink-0 overflow-hidden rounded-[6px] bg-photo">
                  {item.image && <img src={item.image} alt="" className="size-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${item.slug}`} className="text-sm font-semibold text-ink no-underline hover:text-roast">
                    {item.name}
                  </Link>
                  <span className="block text-xs text-ink-3">{productMeta(item)}</span>
                </div>
                <span className="text-[13px] text-ink-2">
                  {item.unit === 'kg' ? `${item.quantity} kg` : item.quantity} × {formatPeso(item.priceCentavos)}
                </span>
                <span className="w-24 text-right text-sm font-semibold">{formatPeso(item.lineTotalCentavos)}</span>
              </div>
            ))}
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-y-1.5 pt-3 text-sm text-ink-2">
              <dt>Subtotal</dt>
              <dd className="m-0 text-right">{formatPeso(o.subtotalCentavos)}</dd>
              <dt>{delivery ? `Delivery fee · ${o.fulfillment.distanceKm} km` : 'Pickup'}</dt>
              <dd className="m-0 text-right">{delivery ? formatPeso(o.deliveryFeeCentavos) : 'Free'}</dd>
              <dt className="border-t border-sand-soft pt-1.5 font-semibold text-ink">{totalLabel}</dt>
              <dd className="m-0 border-t border-sand-soft pt-1.5 text-right text-lg font-semibold text-ink">{formatPeso(o.totalCentavos)}</dd>
            </dl>
          </div>
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          <DestinationCard order={o} />
          <PaymentCard order={o} />
          {o.note && (
            <section aria-labelledby="note-title" className={card}>
              <h2 id="note-title" className={cardTitle}>Your note</h2>
              <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-[1.55] text-ink-2">{o.note}</p>
            </section>
          )}
        </div>

        <section aria-labelledby="timeline-title" className="rounded-card border border-sand bg-white px-5 pb-2 pt-[18px]">
          <h2 id="timeline-title" className="text-[15px] font-semibold">
            Status history
          </h2>
          <StatusTimeline steps={timelineSteps(o)} />
        </section>

        {o.status === 'pending' && (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setCancelling(true)} className="text-danger-ink">
              Cancel order
            </Button>
            <p className="text-[12.5px] text-ink-3">You can cancel while the order is pending. We’ll ask for a reason.</p>
          </div>
        )}
      </div>

      {cancelling && <CancelOrderDialog order={o} onClose={() => setCancelling(false)} />}
    </>
  )
}
