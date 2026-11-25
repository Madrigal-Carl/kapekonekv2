import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconDownload } from '@/components/ui/icons'
import { DASH_ORDER_STATUS, orderStatusFilter, paymentPill } from '@/constants/orderStatus'
import { avatarFor, initialsOf } from '@/constants/records'
import { useAdminOrders, useOrder } from '@/hooks/useOrders'
import { useTableParams } from '@/hooks/useTableParams'
import { formatPesoShort } from '@/lib/format'
import { NotFound } from '@/pages/errors/NotFound'
import { adminOrdersCsvUrl } from '@/services/order.service'
import { DashPage } from '../overview/Overview'
import { OrderManage } from './OrderManage'
import { methodText, stamp } from './orderText'

const PAGE_SIZE = 10
const FILTERS = [
  { key: 'type', label: 'Customer', options: [{ value: '', label: 'All customers' }, { value: 'buyer', label: 'Buyers' }, { value: 'farmer', label: 'Farmers' }] },
  { key: 'method', label: 'Delivery', options: [{ value: '', label: 'Delivery and pickup' }, { value: 'delivery', label: 'Delivery' }, { value: 'pickup', label: 'Pickup' }] },
  { key: 'payment', label: 'Payment', options: [{ value: '', label: 'All payments' }, { value: 'e_wallet', label: 'E-wallet' }, { value: 'cash', label: 'Cash' }] },
]

const toRow = (o) => ({
  id: o._id,
  label: o.orderNumber,
  code: { main: o.orderNumber, sub: stamp(o.createdAt) },
  customer: {
    name: o.customer?.name ?? 'Deleted account',
    sub: o.customer?.role === 'farmer' ? 'Farmer' : 'Buyer',
    initials: initialsOf(o.customer?.name ?? '?'),
    avatarClassName: avatarFor(o.customer?.id),
  },
  total: formatPesoShort(o.totalCentavos),
  method: methodText(o),
  pay: paymentPill(o),
  status: DASH_ORDER_STATUS[o.status],
  actions: [o.status === 'pending' ? 'manage' : 'view'],
})

/** Kaluppa's Orders (OrdersKaluppa.dc.html): every buyer and farmer order, To confirm first, the manage drawer, CSV export. */
export function KaluppaOrders() {
  const query = useTableParams({ status: 'to_confirm' })
  const { params, set } = query
  const filters = { status: params.status, q: params.q, type: params.type, method: params.method, payment: params.payment }
  const list = useAdminOrders({ ...filters, page: params.page, limit: PAGE_SIZE })
  const opened = useOrder(params.open)
  const close = () => set({ open: null, mode: null })

  if (opened.error?.response?.status === 404) return <NotFound />

  return (
    <DashPage>
      <PageHeader
        eyebrow="Marketplace"
        title="Orders"
        description="Buyer and farmer orders. Confirm within 3 days or they expire."
        actions={
          <Button as="a" variant="outline" href={adminOrdersCsvUrl(filters)} download leftIcon={<IconDownload aria-hidden="true" className="size-4" strokeWidth={2} />}>
            Export CSV
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Orders"
        columns={[
          { key: 'code', label: 'Order', kind: 'strong' },
          { key: 'customer', label: 'Customer', kind: 'person' },
          { key: 'total', label: 'Total', align: 'right' },
          { key: 'method', label: 'Delivery' },
          { key: 'pay', label: 'Payment', kind: 'pill' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        rows={list.data?.items.map(toRow)}
        status={orderStatusFilter(false)}
        filters={FILTERS}
        onAction={(_, row) => set({ open: row.id, mode: null })}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          params.status === 'to_confirm'
            ? { title: 'Nothing to confirm', text: 'New buyer and farmer orders show up here.' }
            : { title: 'No orders match', text: 'Try another status or filter.' }
        }
        searchPlaceholder="Search order number or customer"
        minWidth={940}
        selectedId={params.open}
      />
      <OrderManage open={Boolean(params.open)} order={opened.data} onClose={close} />
    </DashPage>
  )
}
