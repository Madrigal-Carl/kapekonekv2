import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as orderService from '@/services/order.service'
import { cartKeys } from './useCart'
import { dashboardKeys } from './useDashboard'

export const orderKeys = {
  all: ['orders'],
  list: (statuses) => ['orders', 'list', statuses ?? 'all'],
  counts: ['orders', 'counts'],
  table: (params) => ['orders', 'table', params],
  admin: (params) => ['orders', 'admin', params],
  detail: (id) => ['orders', 'detail', id],
}

export const useOrders = (statuses) =>
  useInfiniteQuery({
    queryKey: orderKeys.list(statuses),
    queryFn: ({ pageParam }) => orderService.listOrders({ status: statuses, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  })

/** The farmer's Orders table (numbered pages). */
export const useOrderTable = (params) =>
  useQuery({ queryKey: orderKeys.table(params), queryFn: () => orderService.listOrderTable(params), placeholderData: keepPreviousData })

export const useOrderCounts = () => useQuery({ queryKey: orderKeys.counts, queryFn: orderService.getOrderCounts })

export const useOrder = (id) => useQuery({ queryKey: orderKeys.detail(id), queryFn: () => orderService.getOrder(id), enabled: Boolean(id) })

export function usePlaceOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orderService.placeOrder,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order._id), order)
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      queryClient.invalidateQueries({ queryKey: cartKeys.all })
    },
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: orderService.cancelOrder,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order._id), order)
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

/** Kaluppa's Orders table (numbered pages). */
export const useAdminOrders = (params) =>
  useQuery({ queryKey: orderKeys.admin(params), queryFn: () => orderService.listAdminOrders(params), placeholderData: keepPreviousData })

/** Kaluppa's manage actions: the drawer keeps the returned order; lists, badges and overviews refresh. */
function useManageMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order._id), (old) => ({ ...order, customer: old?.customer }))
      queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.badges })
    },
  })
}
export const useChangeOrderStatus = () => useManageMutation(orderService.changeOrderStatus)
export const useMarkOrderRefunded = () => useManageMutation(orderService.markOrderRefunded)
