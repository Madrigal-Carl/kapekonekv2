import { IconChevronRight, IconMapPin } from '@/components/ui/icons'

import { Link } from 'react-router-dom'
import { destinationLine, paymentLabel } from '@/constants/orderStatus'
import { formatDate } from '@/lib/date'
import { formatPeso, quantityShort } from '@/lib/format'
import { RefundBadge, StatusPill } from './StatusPill'

/** Order in the /orders list (Orders.dc.html): header band, item table, footer with destination, payment, total. */
export function OrderCard({ order }) {
  return (
    <article className="overflow-hidden rounded-card border border-sand bg-white transition-shadow duration-200 hover:shadow-card-hover">
      <header className="flex flex-wrap items-center justify-between gap-2.5 border-b border-sand-soft bg-cream px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-[0.01em]">{order.orderNumber}</span>
          <span className="text-[12.5px] text-ink-3">Placed {formatDate(order.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RefundBadge refund={order.refund} />
          <StatusPill status={order.status} />
        </div>
      </header>
      <div className="overflow-x-auto px-5 py-3.5">
        <table className="w-full border-collapse text-[13.5px]">
          <caption className="sr-only">Items in {order.orderNumber}</caption>
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-3">
              <th scope="col" className="py-1.5 font-medium">Item</th>
              <th scope="col" className="py-1.5 text-right font-medium max-[480px]:hidden">Unit price</th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">Qty</th>
              <th scope="col" className="py-1.5 pl-3 text-right font-medium">Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.product} className="border-t border-table-line">
                <td className="py-[9px] font-medium">{item.name}</td>
                <td className="py-[9px] text-right text-ink-2 max-[480px]:hidden">
                  {formatPeso(item.priceCentavos)} / {item.unit}
                </td>
                <td className="whitespace-nowrap py-[9px] pl-3 text-right text-ink-2">{quantityShort(item.quantity, item.unit)}</td>
                <td className="py-[9px] pl-3 text-right font-semibold">{formatPeso(item.lineTotalCentavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-soft px-5 py-3.5">
        <span className="inline-flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
          <IconMapPin aria-hidden="true" className="size-3.5 text-roast" strokeWidth={2} />
          {destinationLine(order)}
          <span className="ml-2 rounded-[4px] border border-sand-strong px-[7px] py-px text-[11px] font-semibold text-ink-2">{paymentLabel(order)}</span>
        </span>
        <div className="flex items-center gap-[18px]">
          <span className="text-[13px] text-ink-3">
            Total <strong className="ml-1 text-base font-semibold text-ink">{formatPeso(order.totalCentavos)}</strong>
          </span>
          <Link to={`/orders/${order._id}`} className="inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-semibold text-roast no-underline" aria-label={`View details of ${order.orderNumber}`}>
            View details
            <IconChevronRight aria-hidden="true" className="size-[15px]" strokeWidth={2} />
          </Link>
        </div>
      </footer>
    </article>
  )
}
