import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { errorMessage } from '@/lib/applyServerErrors'
import * as cartService from '@/services/cart.service'
import { useCartDrawer } from '@/stores/cart.store'
import { useAuth } from './useAuth'
import { useCan } from './useCan'
import { useRequireAuthAction } from './useRequireAuthAction'

export const cartKeys = { all: ['cart'] }

/** The signed-in, verified buyer's cart (disabled for guests and other roles). */
export function useCart() {
  const { isAuthenticated, mustVerify } = useAuth()
  const canCart = useCan('cart.manage')
  return useQuery({ queryKey: cartKeys.all, queryFn: cartService.getCart, enabled: isAuthenticated && !mustVerify && canCart })
}

/** Cart mutations put the returned cart straight into the cache. */
function useCartMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (cart, ...rest) => {
      queryClient.setQueryData(cartKeys.all, cart)
      options.onSuccess?.(cart, ...rest)
    },
  })
}

export const useSetCartQuantity = () => useCartMutation(cartService.setCartQuantity, { onError: (e) => toast.error(errorMessage(e)) })
export const useRemoveCartItem = () => useCartMutation(cartService.removeCartItem)
export const useClearCart = () => useCartMutation(cartService.clearCart)

/**
 * "Add" on product cards and the product page. Guests sign in first, unverified buyers verify first.
 * @returns {{ add: (product: { _id: string, name: string }, quantity?: number) => void, isPending: boolean }}
 */
export function useAddToCart() {
  const requireAuth = useRequireAuthAction()
  const show = useCartDrawer((s) => s.show)
  const mutation = useCartMutation(cartService.addCartItem, {
    onSuccess: (_cart, { name }) => toast.success(`${name} added to your cart`, { action: { label: 'View cart', onClick: show } }),
    onError: (e) => toast.error(errorMessage(e)),
  })
  return {
    add: (product, quantity = product.unit === 'kg' ? 0.5 : 1) =>
      requireAuth(() => mutation.mutate({ productId: product._id, quantity, name: product.name })),
    isPending: mutation.isPending,
  }
}
