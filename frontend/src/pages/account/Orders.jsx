import { IconPackage, IconTriangleAlert } from '@/components/ui/icons'
import { useSearchParams, Link } from 'react-router-dom'
import { OrderCard } from '@/components/order/OrderCard'
import { OrderGroupTabs, StatusChips } from '@/components/order/OrderGroupTabs'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { ORDER_GROUPS } from '@/constants/orderStatus'
import { useInfiniteSentinel } from '@/hooks/useInfiniteSentinel'
import { useOrderCounts, useOrders } from '@/hooks/useOrders'
import { AccountHeading } from '@/layouts/AccountLayout'

function OrderSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3 rounded-card border border-sand-soft bg-white p-5">
      <Skeleton className="h-3.5 w-[30%]" />
      <Skeleton className="h-2.5 w-[70%]" />
      <Skeleton className="h-2.5 w-[55%]" />
    </div>
  )
}

/** /orders (Orders.dc.html). The group and status filters live in the URL (?group=preparing&status=reserved). */
export function Orders() {
  const [params, setParams] = useSearchParams()
  const group = ORDER_GROUPS.find((g) => g.key === params.get('group')) ?? ORDER_GROUPS[0]
  const sub = group.statuses?.includes(params.get('status')) ? params.get('status') : 'all'
  const statuses = sub === 'all' ? group.statuses : [sub]

  const counts = useOrderCounts()
  const orders = useOrders(statuses)
  const sentinel = useInfiniteSentinel(orders)
  const list = orders.data?.pages.flatMap((p) => p.items) ?? []

  const setFilter = (next) => setParams(next, { replace: true })

  return (
    <>
      <div className="mx-auto max-w-[1080px] px-4 pt-9 sm:px-8">
        <AccountHeading eyebrow="Account" title="My orders" />
        <OrderGroupTabs active={group.key} counts={counts.data} onChange={(key) => setFilter(key === 'all' ? {} : { group: key })} />
        {group.statuses?.length > 1 && (
          <StatusChips statuses={group.statuses} active={sub} counts={counts.data} onChange={(s) => setFilter(s === 'all' ? { group: group.key } : { group: group.key, status: s })} />
        )}
      </div>
      <div className="mx-auto max-w-[1080px] px-4 pb-20 pt-6 sm:px-8">
        {orders.isPending ? (
          <div aria-busy="true" className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <OrderSkeleton key={i} />
            ))}
          </div>
        ) : orders.isError ? (
          <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn’t load your orders" action={<Button variant="outline" onClick={() => orders.refetch()}>Try again</Button>} className="bg-white">
            Check your connection and try again.
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState
            icon={IconPackage}
            title={group.key === 'all' ? 'No orders yet' : 'No orders with this status'}
            action={group.key === 'all' && <Button as={Link} to="/products">Browse coffee</Button>}
            className="bg-white"
          >
            Orders you place will show up here.
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {list.map((order) => (
              <li key={order._id}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
        )}
        {orders.isFetchingNextPage && (
          <>
            <div className="mt-4">
              <OrderSkeleton />
            </div>
            <p aria-live="polite" className="mt-4 text-center text-[13px] text-ink-3">
              Loading more orders…
            </p>
          </>
        )}
        <div ref={sentinel} aria-hidden="true" />
      </div>
    </>
  )
}
