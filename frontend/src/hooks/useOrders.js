import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as orderService from '@/services/order.service'
import { cartKeys } from './useCart'

export const orderKeys = {
  all: ['orders'],
  list: (statuses) => ['orders', 'list', statuses ?? 'all'],
  counts: ['orders', 'counts'],
  detail: (id) => ['orders', 'detail', id],
}

export const useOrders = (statuses) =>
  useInfiniteQuery({
    queryKey: orderKeys.list(statuses),
    queryFn: ({ pageParam }) => orderService.listOrders({ status: statuses, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
  })

export const useOrderCounts = () => useQuery({ queryKey: orderKeys.counts, queryFn: orderService.getOrderCounts })

export const useOrder = (id) => useQuery({ queryKey: orderKeys.detail(id), queryFn: () => orderService.getOrder(id) })

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
