import { format } from 'date-fns'
import { History } from '@/components/dashboard/History'
import { useState } from 'react'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { SectionTitle, TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { DASH_ORDER_STATUS, REJECT_OPTIONS } from '@/constants/orderStatus'
import { avatarFor, initialsOf } from '@/constants/records'
import { useChangeOrderStatus, useMarkOrderRefunded } from '@/hooks/useOrders'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatPesoShort, formatPhone } from '@/lib/format'
import { imageUrl } from '@/lib/image'
import { cancelReasonRule, phoneRule } from '@/schemas/rules'
import { DrawerLoading, InfoBox, ItemsList, OrderTimeline } from './OrderParts'
import { destination, isPickup } from './orderText'

const tick = 'flex cursor-pointer items-center gap-2 rounded-md border border-sand-soft bg-cream p-2.5 text-[13.5px]'

/** The next step's button label and status, by the current status (OrdersKaluppa.dc.html). */
function nextStep(order) {
  switch (order.status) {
    case 'reserved': return ['Start processing', 'processing']
    case 'processing': return isPickup(order) ? ['Ready for pickup', 'ready_for_pickup'] : ['Out for delivery', 'out_for_delivery']
    case 'out_for_delivery':
    case 'ready_for_pickup': return ['Mark sold', 'sold']
    default: return null
  }
}

function Receipt({ order, checked, onToggle }) {
  const { payment } = order
  return (
    <>
      <SectionTitle>Payment receipt</SectionTitle>
      <div className="flex items-start gap-3.5 max-[480px]:flex-col">
        <a href={payment.receipt?.url} target="_blank" rel="noreferrer" aria-label={`Open the ${payment.provider} receipt`}
          className="grid aspect-[3/4] w-[150px] shrink-0 place-items-center overflow-hidden rounded-lg bg-espresso">
          {payment.receipt?.url && <img src={imageUrl(payment.receipt.url, 150)} alt="" className="size-full object-contain" />}
        </a>
        <div className="flex flex-1 flex-col gap-2 text-[13px]">
          <span><strong>{payment.provider}</strong></span>
          <span>Order total to match: <strong>{formatPesoShort(order.totalCentavos)}</strong></span>
          {payment.submittedAt && <span className="text-ink-3">Uploaded {format(new Date(payment.submittedAt), 'MMM d, h:mm a')}</span>}
          {order.status === 'pending' ? (
            <label className={tick}>
              <input type="checkbox" checked={checked} onChange={onToggle} className="size-[18px] accent-roast" />
              The receipt matches the total
            </label>
          ) : (
            payment.verifiedAt && <span className="text-ink-3">Verified {format(new Date(payment.verifiedAt), 'MMM d')}</span>
          )}
        </div>
      </div>
    </>
  )
}

/**
 * Kaluppa's manage drawer (OrderManage.dc.html): receipt check → confirm or reject with a reason, then the next step
 * (rider for delivery, cash tick for cash), and the refund reference. Every action is a Phase 1 transition.
 * @param {{ open: boolean, order?: object, onClose: () => void }} props
 */
export function OrderManage({ open, order, onClose }) {
  const change = useChangeOrderStatus()
  const refund = useMarkOrderRefunded()
  const [receiptOk, setReceiptOk] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reasonCode, setReasonCode] = useState(null)
  const [reason, setReason] = useState('')
  const [rider, setRider] = useState({ name: '', phone: '' })
  const [cashOk, setCashOk] = useState(false)
  const [reference, setReference] = useState('')
  const [shownId, setShownId] = useState(null)
  // A different order (or the same one after a step) starts with a clean drawer.
  const key = order && `${order._id}:${order.status}`
  if (key !== shownId) {
    setShownId(key)
    setReceiptOk(false)
    setRejecting(false)
    setReasonCode(null)
    setReason('')
    setRider({ name: order?.fulfillment.rider?.name ?? '', phone: order?.fulfillment.rider?.phone ?? '' })
    setCashOk(false)
    setReference('')
  }

  const run = (mutation, body, message, { close = false } = {}) =>
    mutation.mutate(body, {
      onSuccess: () => {
        toast.success(message)
        if (close) onClose()
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  const wallet = order?.payment.method === 'e_wallet'
  const next = order && nextStep(order)
  const needRider = order?.status === 'processing' && !isPickup(order)
  const needCash = order && ['out_for_delivery', 'ready_for_pickup'].includes(order.status) && !wallet
  const riderOk = rider.name.trim().length >= 2 && phoneRule.safeParse(rider.phone).success
  const rejectOk = Boolean(reasonCode) && (reasonCode !== 'other' || cancelReasonRule.safeParse(reason).success)
  const nextBlocked = (needRider && !riderOk) || (needCash && !cashOk)
  const isRefund = order?.refund?.status === 'pending'
  const pending = change.isPending || refund.isPending
  const customer = order?.customer
  const dest = order && destination(order, { forKaluppa: true })
  const label = order && DASH_ORDER_STATUS[order.status].label

  const confirm = () => run(change, { id: order._id, status: 'reserved' }, `${order.orderNumber} confirmed. Stock reserved.`)
  const reject = () =>
    run(change, { id: order._id, status: 'rejected', reasonCode, ...(reasonCode === 'other' && { reason: reason.trim() }) },
      `${order.orderNumber} rejected.${wallet ? ' A refund is now pending.' : ''}`, { close: true })
  const advance = () =>
    run(change, { id: order._id, status: next[1], ...(needRider && { rider: { name: rider.name.trim(), phone: phoneRule.parse(rider.phone) } }) },
      `${order.orderNumber}: ${DASH_ORDER_STATUS[next[1]].label}.`)
  const markRefunded = () => run(refund, { id: order._id, referenceNumber: reference.trim() }, 'Refund recorded.', { close: true })

  return (
    <Drawer
      open={open}
      width={720}
      eyebrow={order ? `${order.orderNumber} · ${label}` : 'Order'}
      title={order ? `${customer?.name ?? 'Deleted account'} · ${formatPesoShort(order.totalCentavos)}` : 'Loading…'}
      onClose={onClose}
      footer={
        order && (
          <>
            {order.status === 'pending' && !rejecting && (
              <>
                <Button variant="outline" onClick={() => setRejecting(true)} className="text-logout hover:text-logout">Reject</Button>
                <Button onClick={confirm} disabled={wallet && !receiptOk} loading={change.isPending}>Confirm order</Button>
              </>
            )}
            {rejecting && (
              <>
                <Button variant="outline" onClick={() => setRejecting(false)}>Back</Button>
                <Button variant="danger" onClick={reject} disabled={!rejectOk} loading={change.isPending}>Reject order</Button>
              </>
            )}
            {next && (
              <Button onClick={advance} disabled={nextBlocked} loading={change.isPending}>{next[0]}</Button>
            )}
            {isRefund && (
              <Button onClick={markRefunded} disabled={reference.trim().length < 4 || pending} loading={refund.isPending}>Mark refunded</Button>
            )}
          </>
        )
      }
    >
      {!order ? (
        <DrawerLoading />
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-sand p-3">
            <span aria-hidden="true" className={cn('grid size-10 place-items-center rounded-full text-[13px] font-semibold text-white', avatarFor(customer?.id))}>
              {initialsOf(customer?.name ?? '?')}
            </span>
            <div className="flex-1">
              <span className="block text-sm font-semibold">{customer?.name ?? 'Deleted account'}</span>
              <span className="block text-xs text-ink-3">
                {[customer?.role === 'farmer' ? 'Farmer' : 'Buyer', formatPhone(order.fulfillment.contactPhone ?? customer?.phone)].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
          {wallet && <Receipt order={order} checked={receiptOk} onToggle={() => setReceiptOk((v) => !v)} />}
          <SectionTitle>Items</SectionTitle>
          <ItemsList order={order} />
          <InfoBox title={dest.title}>{dest.text}</InfoBox>
          {needRider && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-sand-soft bg-cream p-3.5">
              <strong className="text-[13.5px]">Rider</strong>
              <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
                <TextField id="rider-name" label="Rider name" value={rider.name} maxLength={60} onChange={(e) => setRider({ ...rider, name: e.target.value })} />
                <TextField id="rider-phone" label="Rider phone" type="tel" value={rider.phone} maxLength={13} onChange={(e) => setRider({ ...rider, phone: e.target.value })} />
              </div>
            </div>
          )}
          {needCash && (
            <label className={tick}>
              <input type="checkbox" checked={cashOk} onChange={() => setCashOk((v) => !v)} className="size-[18px] accent-roast" />
              Cash of {formatPesoShort(order.totalCentavos)} collected
            </label>
          )}
          {rejecting && (
            <div className="flex flex-col gap-3">
              <SearchSelect label="Reason for rejecting" icon="tag" placeholder="Choose a reason" options={REJECT_OPTIONS} value={reasonCode} onChange={setReasonCode} searchable={false} />
              {reasonCode === 'other' && (
                <TextField id="reject-reason" label="Tell the customer why" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              )}
            </div>
          )}
          {isRefund && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-danger-line bg-danger-soft p-3.5">
              <strong className="text-[13.5px] text-danger-text">Refund {formatPesoShort(order.totalCentavos)} to the customer’s {order.payment.provider}</strong>
              <TextField id="refund-ref" label="Refund reference number" placeholder="e.g. 5011 2290 774" value={reference} maxLength={40} onChange={(e) => setReference(e.target.value)} />
            </div>
          )}
          <SectionTitle>Status</SectionTitle>
          <OrderTimeline order={order} />
          <History entityType="order" entityId={order._id} />
        </>
      )}
    </Drawer>
  )
}
