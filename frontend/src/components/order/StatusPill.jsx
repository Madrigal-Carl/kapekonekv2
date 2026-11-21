import { ORDER_STATUS, refundLabel } from '@/constants/orderStatus'
import { cn } from '@/lib/cn'

/** Coloured status pill with a dot (Orders / OrderDetail). `size="lg"` is the order page header. */
export function StatusPill({ status, size = 'sm' }) {
  const s = ORDER_STATUS[status]
  return (
    <span className={cn('inline-flex items-center rounded-full font-semibold', s.pill, size === 'lg' ? 'gap-2 px-3.5 py-1.5 text-[13px]' : 'gap-1.5 px-2.5 py-1 text-xs')}>
      <span aria-hidden="true" className={cn('rounded-full', s.dot, size === 'lg' ? 'size-2' : 'size-1.5')} />
      {s.label}
    </span>
  )
}

/** "Refund pending" / "Refunded · Ref …" badge; renders nothing when there's no refund. */
export function RefundBadge({ refund }) {
  const label = refundLabel(refund)
  if (!label) return null
  return <span className="rounded-full border border-notice-line bg-notice-bg px-2.5 py-[3px] text-[11.5px] font-semibold text-caramel-badge">{label}</span>
}
