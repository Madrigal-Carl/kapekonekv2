import { useState } from 'react'
import { History } from '@/components/dashboard/History'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { Drawer } from '@/components/dashboard/Drawer'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SectionTitle } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { IconStore } from '@/components/ui/icons'
import { DASH_ORDER_STATUS, orderStatusFilter, paymentPill } from '@/constants/orderStatus'
import { useCancelOrder, useOrder, useOrderTable } from '@/hooks/useOrders'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatPesoShort } from '@/lib/format'
import { NotFound } from '@/pages/errors/NotFound'
import { DashPage } from '../overview/Overview'
import { Banner, DrawerLoading, InfoBox, ItemsList, OrderTimeline } from './OrderParts'
import { destination, farmerBanner, itemsText, methodText, orderTitle, paymentBox, stamp } from './orderText'

const PAGE_SIZE = 10
// The screen's four reasons, on the server's reason codes (BUYER_CANCEL_REASONS).
const CANCEL_OPTIONS = [
  { value: 'change_delivery_address', label: 'Change delivery address' },
  { value: 'change_items', label: 'Change items' },
  { value: 'ordered_by_mistake', label: 'Ordered by mistake' },
  { value: 'other', label: 'Other' },
]

const toRow = (o) => ({
  id: o._id,
  label: o.orderNumber,
  code: { main: o.orderNumber, sub: stamp(o.createdAt) },
  items: { main: itemsText(o), sub: `${o.items.length} ${o.items.length === 1 ? 'item' : 'items'}` },
  total: formatPesoShort(o.totalCentavos),
  method: methodText(o),
  pay: paymentPill(o),
  status: DASH_ORDER_STATUS[o.status],
  actions: ['view'],
})

function OrderView({ open, order, onCancel, onClose }) {
  const dest = order && destination(order)
  const pay = order && paymentBox(order)
  return (
    <Drawer
      open={open}
      width={640}
      eyebrow={order?.orderNumber ?? 'Order'}
      title={order ? orderTitle(order) : 'Loading…'}
      onClose={onClose}
      footer={
        order && (
          <>
            {order.status === 'pending' && (
              <Button variant="outline" onClick={onCancel} className="text-logout hover:text-logout">Cancel order</Button>
            )}
            <Button as={Link} variant="outline" to={`/orders/${order._id}`}>Open full page</Button>
          </>
        )
      }
    >
      {!order ? (
        <DrawerLoading />
      ) : (
        <>
          <Banner banner={farmerBanner(order)} />
          <SectionTitle>Items</SectionTitle>
          <ItemsList order={order} />
          <div className="grid grid-cols-2 gap-5 max-[720px]:grid-cols-1">
            <InfoBox title={dest.title}>{dest.text}</InfoBox>
            <InfoBox title={pay.title}>{pay.text}</InfoBox>
          </div>
          <SectionTitle>Status</SectionTitle>
          <OrderTimeline order={order} />
          <History entityType="order" entityId={order._id} />
        </>
      )}
    </Drawer>
  )
}

/** The farmer's store orders (OrdersFarmer.dc.html): table, view drawer, cancel while Kaluppa hasn't confirmed. */
export function FarmerOrders() {
  const query = useTableParams()
  const { params, set } = query
  const list = useOrderTable({ group: params.status, q: params.q, page: params.page, limit: PAGE_SIZE })
  const opened = useOrder(params.open)
  const cancel = useCancelOrder()
  const [cancelling, setCancelling] = useState(false)
  const close = () => set({ open: null, mode: null })
  const filtered = Boolean(params.q || params.status)

  const confirmCancel = (reason, reasonCode) =>
    cancel.mutate(
      { id: opened.data._id, reasonCode, reason },
      {
        onSuccess: (o) => {
          toast.success(`${o.orderNumber} was cancelled.`)
          setCancelling(false)
          close()
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )

  if (opened.error?.response?.status === 404) return <NotFound />

  return (
    <DashPage>
      <PageHeader
        eyebrow="Marketplace"
        title="My orders"
        description="Fertilizer and seedlings you ordered from the Kaluppa store."
        actions={
          <Button as={Link} to="/products" leftIcon={<IconStore aria-hidden="true" className="size-4" strokeWidth={2} />}>
            Go to store
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Orders"
        columns={[
          { key: 'code', label: 'Order', kind: 'strong' },
          { key: 'items', label: 'Items', wrap: true },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'method', label: 'Delivery' },
          { key: 'pay', label: 'Payment', kind: 'pill' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        rows={list.data?.items.map(toRow)}
        status={orderStatusFilter(true)}
        onAction={(_, row) => set({ open: row.id, mode: null })}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          filtered
            ? { title: 'No orders match', text: 'Try another status or search.' }
            : { title: 'No orders yet', text: 'Fertilizer and seedlings you order from the store show up here.' }
        }
        searchPlaceholder="Search order number or item"
        minWidth={980}
        selectedId={params.open}
      />
      <OrderView open={Boolean(params.open)} order={opened.data} onCancel={() => setCancelling(true)} onClose={close} />
      <ConfirmModal
        open={cancelling}
        variant="cancel_sale"
        title="Cancel this order?"
        confirmLabel="Cancel order"
        cancelLabel="Keep order"
        reasonOptions={CANCEL_OPTIONS}
        pending={cancel.isPending}
        onClose={() => setCancelling(false)}
        onConfirm={confirmCancel}
      >
        You can cancel while Kaluppa hasn’t confirmed it yet.
      </ConfirmModal>
    </DashPage>
  )
}
