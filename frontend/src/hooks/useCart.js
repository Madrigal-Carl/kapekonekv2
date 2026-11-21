import { toast } from 'sonner'
import { useRequireAuthAction } from './useRequireAuthAction'

/**
 * "Add" on product cards and the product page. Guests sign in first, unverified buyers verify first.
 * shortcut: the cart API and drawer land in M4; until then a signed-in buyer gets a notice. Replace the body then.
 * @returns {(product: { name: string }, quantity?: number) => void}
 */
export function useAddToCart() {
  const requireAuth = useRequireAuthAction()
  return (product) => requireAuth(() => toast(`${product.name} is ready for your cart. The cart opens in the next update.`))
}
