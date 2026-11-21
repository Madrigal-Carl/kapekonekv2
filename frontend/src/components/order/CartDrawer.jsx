import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, TriangleAlert, X } from 'lucide-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { productMeta } from '@/constants/catalog'
import { useCart, useClearCart, useRemoveCartItem, useSetCartQuantity } from '@/hooks/useCart'
import { formatPeso, quantityShort, quantityWords } from '@/lib/format'
import { stepFor } from '@/lib/quantity'
import { useCartDrawer } from '@/stores/cart.store'

/** Why a line blocks checkout. */
function flagText({ flags, product }) {
  if (flags.includes('INACTIVE')) return 'This item is no longer available. Remove it to check out.'
  if (flags.includes('NOT_PURCHASABLE')) return 'Your account can’t buy this item. Remove it to check out.'
  if (flags.includes('OUT_OF_STOCK')) return 'Sold out. Remove it to check out.'
  if (flags.includes('OVER_STOCK')) return `Only ${quantityWords(product.stock, product.unit)} left. Lower the quantity to check out.`
  return null
}

function CartLine({ line, onRemove }) {
  const { product, quantity } = line
  const setQuantity = useSetCartQuantity()
  const step = stepFor(product.unit)
  const warning = flagText(line)
  const change = (next) => setQuantity.mutate({ productId: product._id, quantity: next })
  const stepButton = 'grid size-9 cursor-pointer place-items-center border-0 bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <li className="border-b border-sand-soft py-[18px]">
      <div className="flex gap-3.5">
        <span aria-hidden="true" className="size-[72px] shrink-0 overflow-hidden rounded-[6px] bg-photo">
          {product.image && <img src={product.image} alt="" className="size-full object-cover" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-2">
            <span className="text-[14.5px] font-semibold leading-[1.3]">{product.name}</span>
            <button
              type="button"
              aria-label={`Remove ${product.name}`}
              onClick={() => onRemove(line)}
              className="-mr-2 -mt-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-ink-4 hover:bg-crema"
            >
              <Trash2 aria-hidden="true" className="size-[17px]" strokeWidth={1.75} />
            </button>
          </div>
          <span className="mt-0.5 block text-xs text-ink-3">{productMeta(product)}</span>
          <span className="mt-0.5 block text-[12.5px] text-ink-2">
            {formatPeso(product.priceCentavos)} / {product.unit}
          </span>
          <div className="mt-2.5 flex items-center justify-between">
            <div role="group" aria-label={`Quantity for ${product.name}`} className="inline-flex items-center overflow-hidden rounded-control border border-sand-strong">
              <button type="button" aria-label="Decrease" disabled={quantity <= step || setQuantity.isPending} onClick={() => change(quantity - step)} className={stepButton}>
                <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
              <output aria-live="polite" className="min-w-[52px] border-x border-sand text-center text-[13.5px] font-semibold leading-9">
                {quantityShort(quantity, product.unit)}
              </output>
              <button
                type="button"
                aria-label="Increase"
                disabled={quantity + step > product.stock || setQuantity.isPending}
                onClick={() => change(quantity + step)}
                className={stepButton}
              >
                <Plus aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </button>
            </div>
            <span className="text-[15px] font-semibold">{formatPeso(line.lineTotalCentavos)}</span>
          </div>
          {warning && (
            <p role="alert" className="mt-2.5 flex items-start gap-2 rounded-control border border-notice-line bg-notice-bg px-2.5 py-2 text-[12.5px] text-caramel-badge">
              <TriangleAlert aria-hidden="true" className="mt-px size-[15px] shrink-0" strokeWidth={2} />
              {warning}
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

/** Right drawer with the buyer's cart (CartDrawer.dc.html). Remove, clear and checkout each confirm first. */
export function CartDrawer() {
  const id = useId()
  const { open, hide } = useCartDrawer()
  const navigate = useNavigate()
  const cart = useCart()
  const remove = useRemoveCartItem()
  const clear = useClearCart()
  const [removing, setRemoving] = useState(null)
  const [confirm, setConfirm] = useState(null) // 'clear' | 'checkout'
  const lines = cart.data?.lines ?? []
  const count = lines.length

  const removeLine = () => remove.mutate(removing.product._id, { onSuccess: () => setRemoving(null) })
  const clearAll = () => clear.mutate(undefined, { onSuccess: () => setConfirm(null) })
  const toCheckout = () => {
    setConfirm(null)
    hide()
    navigate('/checkout')
  }

  return (
    <>
      <Modal open={open} onClose={hide} labelledBy={`${id}-title`} placement="right">
        <div className="flex items-center justify-between border-b border-sand px-6 py-5">
          <div>
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{count === 1 ? '1 item' : `${count} items`}</span>
            <h2 id={`${id}-title`} className="mt-0.5 text-xl font-semibold tracking-[-0.01em]">
              Your cart
            </h2>
          </div>
          <button type="button" aria-label="Close cart" onClick={hide} className="grid size-11 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-ink-2 hover:bg-crema">
            <X aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </button>
        </div>

        {cart.isPending ? (
          <div aria-busy="true" className="flex-1 px-6 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3.5 border-b border-sand-soft py-[18px]">
                <Skeleton className="size-[72px] rounded-[6px]" />
                <div className="flex flex-1 flex-col gap-2.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                  <Skeleton className="mt-2 h-9 w-32" />
                </div>
              </div>
            ))}
          </div>
        ) : cart.isError ? (
          <div className="flex-1 p-6">
            <EmptyState icon={TriangleAlert} tone="error" title="We couldn’t load your cart" action={<Button variant="outline" onClick={() => cart.refetch()}>Try again</Button>}>
              Check your connection and try again.
            </EmptyState>
          </div>
        ) : count === 0 ? (
          <div className="flex-1 p-6">
            <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Button to="/products" onClick={hide}>Browse coffee</Button>}>
              Add coffee from the products page and it will show up here.
            </EmptyState>
          </div>
        ) : (
          <>
            <ul className="m-0 flex-1 list-none overflow-y-auto px-6 py-2">
              {lines.map((line) => (
                <CartLine key={line.product._id} line={line} onRemove={setRemoving} />
              ))}
            </ul>
            <div className="border-t border-sand bg-white px-6 pb-6 pt-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-2">Subtotal</span>
                <span className="text-[22px] font-semibold">{formatPeso(cart.data.subtotalCentavos)}</span>
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-3">Choose delivery or pickup and how to pay (GCash, Maya or cash) at checkout.</p>
              <div className="mt-4 flex flex-col gap-2.5">
                {cart.data.canCheckout ? (
                  <Button onClick={() => setConfirm('checkout')} className="min-h-12 w-full">
                    Checkout
                    <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
                  </Button>
                ) : (
                  <button type="button" disabled className="min-h-12 w-full rounded-control border-0 bg-disabled-bg px-4 py-3 text-sm font-semibold text-disabled-ink">
                    Checkout
                  </button>
                )}
                <Button variant="outline" onClick={() => setConfirm('clear')} className="min-h-12 w-full">
                  Clear cart
                </Button>
              </div>
              <p className="mt-2.5 text-center text-[11.5px] text-ink-4">Removing items, clearing the cart and checking out each ask you to confirm first.</p>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={removeLine}
        pending={remove.isPending}
        icon={Trash2}
        tone="danger"
        title="Remove this item?"
        description={removing && `${removing.product.name} (${quantityWords(removing.quantity, removing.product.unit)}) will be removed from your cart.`}
        cancelLabel="Keep it"
        confirmLabel="Remove"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={confirm === 'clear'}
        onClose={() => setConfirm(null)}
        onConfirm={clearAll}
        pending={clear.isPending}
        icon={Trash2}
        tone="danger"
        title="Clear your cart?"
        description={`All ${count === 1 ? '1 item' : `${count} items`} will be removed from your cart.`}
        cancelLabel="Keep them"
        confirmLabel="Clear cart"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={confirm === 'checkout'}
        onClose={() => setConfirm(null)}
        onConfirm={toCheckout}
        icon={ShoppingBag}
        title="Continue to checkout?"
        description={`${count === 1 ? '1 item' : `${count} items`} · ${formatPeso(cart.data?.subtotalCentavos ?? 0)}. Items can’t be changed on the checkout page.`}
        cancelLabel="Keep shopping"
        confirmLabel="Checkout"
      />
    </>
  )
}
