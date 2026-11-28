import { ProductImage } from '@/components/product/ProductImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { BANNER_TONES } from '@/components/dashboard/bannerTones'
import { DASH_ORDER_STATUS, riderText } from '@/constants/orderStatus'
import { cn } from '@/lib/cn'
import { formatPesoShort, quantityShort } from '@/lib/format'
import { squareUrl } from '@/lib/image'
import { isPickup, stamp } from './orderText'

// Pieces the farmer's view drawer and Kaluppa's manage drawer share (OrdersFarmer / OrdersKaluppa .dc.html).

export function DrawerLoading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

/** The order's lines, then the delivery fee and total. */
export function ItemsList({ order }) {
  const f = order.fulfillment
  return (
    <ul className="m-0 list-none rounded-lg border border-sand p-0">
      {order.items.map((item) => (
        <li key={String(item.product)} className="flex items-center gap-3 border-b border-skeleton px-3 py-2.5">
          <ProductImage src={item.image && squareUrl(item.image, 40)} className="size-10 shrink-0 overflow-hidden rounded-md" />
          <span className="flex-1 text-[13.5px]">
            <strong>{item.name}</strong>
            <span className="block text-xs text-ink-3">Qty {quantityShort(item.quantity, item.unit)}</span>
          </span>
          <span className="text-[13.5px] font-semibold">{formatPesoShort(item.lineTotalCentavos)}</span>
        </li>
      ))}
      <li className="flex justify-between px-3 py-2.5 text-[13px] text-ink-2">
        <span>Delivery fee · {isPickup(order) ? 'pickup, free' : `${f.distanceKm} km`}</span>
        <span>{formatPesoShort(order.deliveryFeeCentavos)}</span>
      </li>
      <li className="flex justify-between border-t border-sand px-3 py-2.5 text-[15px] font-semibold">
        <span>Total</span>
        <span>{formatPesoShort(order.totalCentavos)}</span>
      </li>
    </ul>
  )
}

/** A small bordered box: bold title, muted line. */
export function InfoBox({ title, children }) {
  return (
    <div className="rounded-lg border border-sand px-3.5 py-3 text-[13px] leading-[1.6]">
      <strong>{title}</strong>
      <span className="block text-ink-2">{children}</span>
    </div>
  )
}

const ROLE_WORD = { buyer: 'the buyer', farmer: 'the farmer', kaluppa: 'Kaluppa', system: 'the system' }

/**
 * The status history, then (while the order is open) the steps still to come marked "Next".
 * @param {{ order: object }} props
 */
export function OrderTimeline({ order }) {
  const path = ['pending', 'reserved', 'processing', isPickup(order) ? 'ready_for_pickup' : 'out_for_delivery', 'sold']
  const done = (order.statusHistory ?? []).map((h) => ({
    key: `${h.status}-${h.at}`,
    title: h.status === 'pending' ? 'Placed' : DASH_ORDER_STATUS[h.status].label,
    text: [stamp(h.at), h.status !== 'pending' && h.byRole && `by ${ROLE_WORD[h.byRole] ?? h.byRole}`, h.reason, h.status === 'out_for_delivery' && riderText(order.fulfillment.rider)]
      .filter(Boolean)
      .join(' · '),
    done: true,
  }))
  const at = path.indexOf(order.status)
  const next = at < 0 ? [] : path.slice(at + 1).map((s) => ({ key: s, title: DASH_ORDER_STATUS[s].label, text: 'Next', done: false }))
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {[...done, ...next].map((t) => (
        <li key={t.key} className="flex gap-3">
          <span className="flex flex-col items-center">
            <span aria-hidden="true" className={cn('size-3 rounded-full border-2', t.done ? 'border-tone-roast-bg bg-roast' : 'border-sand-strong bg-white')} />
            <span aria-hidden="true" className="min-h-[18px] w-0.5 flex-1 bg-sand-soft" />
          </span>
          <span className="pb-3 text-[13px]">
            <strong className={t.done ? 'text-ink' : 'text-ink-3'}>{t.title}</strong>
            <span className="block text-ink-3">{t.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Banner({ banner }) {
  return (
    <div role="status" className={cn('rounded-lg border px-4 py-3.5', BANNER_TONES[banner.tone])}>
      <span className="block text-[14.5px] font-semibold">{banner.title}</span>
      <span className="mt-[3px] block text-[13px]">{banner.text}</span>
    </div>
  )
}
