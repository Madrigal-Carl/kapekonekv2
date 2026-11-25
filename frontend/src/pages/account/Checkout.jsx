import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { IconBanknote, IconCalendar, IconMapPin, IconPlus, IconShoppingBag, IconTriangleAlert, IconWallet } from '@/components/ui/icons'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AddressFormModal } from '@/components/map/AddressFormModal'
import { DefaultBadge, LabelChip } from '@/components/map/AddressCard'
import { ReceiptUpload } from '@/components/order/ReceiptUpload'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAddresses } from '@/hooks/useAddresses'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { usePointQuote } from '@/hooks/useGeo'
import { usePlaceOrder } from '@/hooks/useOrders'
import { useDeliveryInfo, usePaymentSettings } from '@/hooks/useSettings'
import { addressLabel, addressLine, quoteErrorText } from '@/lib/address'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatPeso, formatPhone, quantityWords } from '@/lib/format'
import { checkoutSchema } from '@/schemas/order.schema'
import { useCartDrawer } from '@/stores/cart.store'
import { imageUrl } from '@/lib/image'

const FIELDS = ['addressId', 'contactPhone', 'provider', 'receipt', 'note']
const etaText = (eta) => (eta ? `${format(new Date(eta.from), 'MMM d')} – ${format(new Date(eta.to), 'MMM d')}` : null)

/** Card choice with a radio (method, address and payment cards). Selected: 2px roast border + highlight. */
function Choice({ checked, className, children, ...input }) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-card p-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-roast',
        checked ? 'border-2 border-roast bg-highlight' : 'border border-sand bg-white',
        className,
      )}
    >
      <input type="radio" checked={checked} className="mt-[3px] size-[18px] shrink-0 accent-roast" {...input} />
      {children}
    </label>
  )
}

function Section({ n, title, action, muted, children }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-card border border-sand bg-white">
      <header className="flex flex-wrap items-center justify-between gap-x-3 border-b border-sand-soft px-[22px] py-[18px]">
        <div className="flex items-center gap-3">
          <span className={cn('grid size-7 place-items-center rounded-full text-[13px] font-semibold', muted ? 'bg-caramel-tint text-caramel-badge' : 'bg-roast text-white')}>{n}</span>
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

function SummaryRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-2.5">
      <dt className="w-[18px] shrink-0">
        <Icon role="img" aria-label={label} className="size-4 text-roast" strokeWidth={2} />
      </dt>
      <dd className="m-0">{children}</dd>
    </div>
  )
}

/** "Place this order?" (Modals.dc.html). */
function PlaceOrderDialog({ open, onClose, onConfirm, pending, rows, ewallet }) {
  const id = useId()
  return (
    <Modal open={open} onClose={pending ? () => {} : onClose} labelledBy={`${id}-title`} className="max-w-[440px] overflow-hidden">
      <div className="border-b border-sand-soft px-6 py-[18px]">
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">Confirm order</span>
        <h2 id={`${id}-title`} className="mt-0.5 text-lg font-semibold">
          Place this order?
        </h2>
      </div>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 px-6 py-[18px] text-[13.5px]">
        {rows.map(([dt, dd]) => (
          <div key={dt} className="contents">
            <dt className="text-ink-3">{dt}</dt>
            <dd className="m-0 font-semibold">{dd}</dd>
          </div>
        ))}
      </dl>
      <p className="mx-6 rounded-[6px] border border-notice-line bg-notice-bg px-3 py-2.5 text-[12.5px] leading-[1.6] text-notice-ink">
        Kaluppa confirms within 3 days. If it doesn’t, the order expires{ewallet ? ' and your e-wallet payment is refunded' : ''}.
      </p>
      <div className="mt-[18px] flex justify-end gap-2.5 border-t border-sand-soft bg-cream px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={pending}>
          Go back
        </Button>
        <Button onClick={onConfirm} loading={pending}>
          Place order
        </Button>
      </div>
    </Modal>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-wrap items-start gap-7">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-card border border-sand-soft bg-white p-[22px]">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
      <div className="flex-[1_1_340px] rounded-card border border-sand-soft bg-white p-[22px]">
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

/** /checkout (Checkout.dc.html): method, address or pickup, payment, note, and the live summary. */
export function Checkout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const showCart = useCartDrawer((s) => s.show)
  const cart = useCart()
  const addresses = useAddresses()
  const delivery = useDeliveryInfo()
  const payment = usePaymentSettings()
  const place = usePlaceOrder()
  const [addingAddress, setAddingAddress] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { method: 'delivery', addressId: '', contactPhone: formatPhone(user?.contactNumber ?? ''), paymentMethod: 'e_wallet', provider: 'GCash', receipt: null, note: '' },
  })
  const [method, addressId, paymentMethod, provider, receipt] = useWatch({ control, name: ['method', 'addressId', 'paymentMethod', 'provider', 'receipt'] })

  // Pre-select the default address once the list arrives.
  useEffect(() => {
    const saved = addresses.data
    if (!addressId && saved?.length) setValue('addressId', (saved.find((a) => a.isDefault) ?? saved[0])._id)
  }, [addressId, addresses.data, setValue])
  const list = addresses.data ?? []

  const isDelivery = method === 'delivery'
  const ewallet = paymentMethod === 'e_wallet'
  const selected = list.find((a) => a._id === addressId)
  const pickup = delivery.data?.pickup
  const pickupQuote = usePointQuote(!isDelivery && pickup ? pickup.location : null)
  const quote = isDelivery ? selected?.quote : null
  const eta = isDelivery ? quote?.eta : pickupQuote.data?.eta

  if (cart.isPending || addresses.isPending || delivery.isPending) {
    return <CheckoutShell><CheckoutSkeleton /></CheckoutShell>
  }
  if (cart.isError || addresses.isError || delivery.isError) {
    return (
      <CheckoutShell>
        <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn’t load checkout" action={<Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>} className="bg-white">
          Check your connection and try again.
        </EmptyState>
      </CheckoutShell>
    )
  }
  const { lines, subtotalCentavos, canCheckout } = cart.data
  if (!lines.length) {
    return (
      <CheckoutShell>
        <EmptyState icon={IconShoppingBag} title="Your cart is empty" action={<Button as={Link} to="/products">Browse coffee</Button>} className="bg-white">
          Add coffee to your cart, then come back to check out.
        </EmptyState>
      </CheckoutShell>
    )
  }

  const feeCentavos = isDelivery ? (quote?.feeCentavos ?? 0) : 0
  const total = subtotalCentavos + feeCentavos
  const cashLabel = isDelivery ? 'Cash on delivery' : 'Cash on pickup'
  const destination = isDelivery ? (selected ? `${addressLabel(selected)} · ${addressLine(selected)}` : 'Choose a delivery address') : `Pick up at ${pickup.name}, ${pickup.address.replace(/, Marinduque$/, '')}`
  const blockedReason = !canCheckout ? 'Some items in your cart need attention.' : isDelivery && selected?.quoteError ? quoteErrorText(selected.quoteError) : null

  const submit = handleSubmit(() => setConfirming(true))
  const confirm = handleSubmit((values) => {
    const body = {
      method: values.method,
      ...(isDelivery ? { addressId: values.addressId } : { contactPhone: values.contactPhone }),
      paymentMethod: values.paymentMethod,
      ...(ewallet && { provider: values.provider, receipt: { url: values.receipt.url, publicId: values.receipt.publicId } }),
      note: values.note || undefined,
    }
    place.mutate(body, {
      onSuccess: (order) => {
        toast.success(`Order ${order.orderNumber} placed`)
        navigate(`/orders/${order._id}`, { replace: true })
      },
      onError: (error) => {
        setConfirming(false)
        if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
      },
    })
  })

  const rows = [
    ['Total', `${formatPeso(total)} · ${ewallet ? provider : cashLabel}${isDelivery ? ` (incl. ${formatPeso(feeCentavos)} delivery)` : ''}`],
    isDelivery ? ['Deliver to', selected ? `${addressLabel(selected)} · ${selected.barangay}, ${selected.municipality}` : '—'] : ['Pick up at', `${pickup.name}, ${pickup.address}`],
    [isDelivery ? 'Arrives' : 'Ready', eta ? `Est. ${etaText(eta)}` : '3–5 business days after Kaluppa confirms'],
    ...(ewallet && receipt ? [['Receipt', receipt.name ?? 'Uploaded']] : []),
  ]

  return (
    <CheckoutShell>
      <div className="flex flex-wrap items-start gap-7">
        <form id="checkout" onSubmit={submit} noValidate className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {/* 1 METHOD */}
          <Section n={1} title="How do you want to get it?">
            <fieldset className="m-0 border-0 px-[22px] py-5">
              <legend className="sr-only">Delivery method</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                <Choice name="method" value="delivery" checked={isDelivery} onChange={() => setValue('method', 'delivery')}>
                  <span>
                    <span className="block text-[15px] font-semibold">Deliver to my address</span>
                    <span className="mt-0.5 block text-[12.5px] leading-normal text-ink-3">Anywhere in Marinduque. Fee based on road distance from Kaluppa.</span>
                  </span>
                </Choice>
                <Choice name="method" value="pickup" checked={!isDelivery} onChange={() => setValue('method', 'pickup')}>
                  <span>
                    <span className="block text-[15px] font-semibold">Pick up at {pickup.name}</span>
                    <span className="mt-0.5 block text-[12.5px] leading-normal text-ink-3">{pickup.address.split(',').slice(0, 2).join(',')}. No delivery fee.</span>
                  </span>
                </Choice>
              </div>
            </fieldset>
          </Section>

          {/* 2 ADDRESS / PICKUP */}
          <Section
            n={2}
            title={isDelivery ? 'Delivery address' : `Pickup at ${pickup.name}`}
            action={
              isDelivery && list.length < 10 && (
                <Button variant="link" onClick={() => setAddingAddress(true)} leftIcon={<IconPlus aria-hidden="true" className="size-[15px]" strokeWidth={2} />} className="h-10 gap-1.5 text-[13.5px]">
                  Add new address
                </Button>
              )
            }
          >
            {isDelivery ? (
              <fieldset className="m-0 border-0 px-[22px] py-5">
                <legend className="sr-only">Choose a delivery address</legend>
                {list.length === 0 ? (
                  <EmptyState icon={IconMapPin} title="No saved addresses yet" action={<Button onClick={() => setAddingAddress(true)}>Add new address</Button>} className="py-10">
                    Add where we should deliver. We deliver anywhere in Marinduque.
                  </EmptyState>
                ) : (
                  <div className="flex flex-col gap-3">
                    {list.map((a) => (
                      <Choice key={a._id} name="addressId" value={a._id} checked={a._id === addressId} onChange={() => setValue('addressId', a._id, { shouldValidate: true })}>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-[14.5px] font-semibold">{a.recipientName}</span>
                            <span className="text-[13px] text-ink-3">{formatPhone(a.phone)}</span>
                            <LabelChip>{addressLabel(a)}</LabelChip>
                            {a.isDefault && <DefaultBadge />}
                          </span>
                          <span className="mt-1 block text-[13.5px] leading-[1.55] text-ink-2">{addressLine(a)}</span>
                          <span className={cn('mt-1.5 inline-flex items-center gap-1.5 text-xs', a.quoteError ? 'text-danger-ink' : 'text-ink-3')}>
                            <IconMapPin aria-hidden="true" className="size-[13px] shrink-0" strokeWidth={2} />
                            {a.quote ? `${a.quote.distanceKm} km by road from Kaluppa · delivery ${formatPeso(a.quote.feeCentavos)}` : quoteErrorText(a.quoteError)}
                          </span>
                        </span>
                        <Link to="/addresses" className="py-1 text-[12.5px] font-semibold no-underline">
                          Edit
                        </Link>
                      </Choice>
                    ))}
                  </div>
                )}
                <FieldHint error={errors.addressId?.message} />
                <p className="mt-3 text-[12.5px] text-ink-3">
                  Manage saved addresses in{' '}
                  <Link to="/addresses" className="font-semibold no-underline">
                    Addresses
                  </Link>
                  . We deliver anywhere in Marinduque.
                </p>
              </fieldset>
            ) : (
              <div className="flex flex-col gap-4 px-[22px] py-5">
                <div className="flex items-start gap-3.5 rounded-card bg-crema p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-card bg-white text-roast">
                    <IconMapPin aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
                  </span>
                  <div>
                    <span className="block text-[15px] font-semibold">{pickup.name}</span>
                    <span className="mt-0.5 block text-[13.5px] text-ink-2">{pickup.address}</span>
                    <span className="mt-0.5 block text-[12.5px] text-ink-3">{pickup.hours} · We’ll notify you when it’s ready for pickup.</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="contact-phone">Contact number</Label>
                  <input
                    id="contact-phone"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={Boolean(errors.contactPhone) || undefined}
                    aria-describedby="contact-phone-hint"
                    className={cn(inputClasses, 'mt-2 max-w-[340px]')}
                    {...register('contactPhone')}
                  />
                  <FieldHint id="contact-phone-hint" error={errors.contactPhone?.message}>
                    Required. Kaluppa may contact you about your pickup. Saved to your profile.
                  </FieldHint>
                </div>
              </div>
            )}
          </Section>

          {/* 3 PAYMENT */}
          <Section n={3} title="Payment">
            <div className="flex flex-col gap-[18px] px-[22px] py-5">
              <fieldset className="m-0 border-0 p-0">
                <legend className="sr-only">Payment method</legend>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                  <Choice name="paymentMethod" value="e_wallet" checked={ewallet} onChange={() => setValue('paymentMethod', 'e_wallet')}>
                    <span>
                      <span className="block text-[15px] font-semibold">GCash or Maya</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-3">Pay now and upload your receipt.</span>
                    </span>
                  </Choice>
                  <Choice name="paymentMethod" value="cash" checked={!ewallet} onChange={() => setValue('paymentMethod', 'cash', { shouldValidate: false })}>
                    <span>
                      <span className="block text-[15px] font-semibold">{cashLabel}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-3">{isDelivery ? 'Pay the rider when it arrives.' : 'Pay at Kaluppa when you collect it.'}</span>
                    </span>
                  </Choice>
                </div>
              </fieldset>

              {ewallet ? (
                <div className="flex flex-wrap gap-7 pt-1">
                  <div className="flex flex-none flex-col items-center gap-2.5 max-sm:w-full">
                    <div role="tablist" aria-label="E-wallet" className="inline-flex rounded-[6px] bg-foam p-[3px]">
                      {(payment.data?.providers ?? ['GCash', 'Maya']).map((name) => (
                        <Button variant="bare"
                          key={name}
                          role="tab"
                          aria-selected={provider === name}
                          onClick={() => setValue('provider', name)}
                          className={cn('min-h-9 cursor-pointer rounded-control border-0 px-[18px] py-2 text-[13px] font-semibold', provider === name ? 'bg-white text-ink' : 'bg-transparent text-ink-3')}
                        >
                          {name}
                        </Button>
                      ))}
                    </div>
                    <div className="relative size-[200px] rounded-card border border-sand bg-white p-3.5">
                      {payment.data?.qrImageUrl ? (
                        <img src={imageUrl(payment.data.qrImageUrl, 240)} alt={`${provider} QR code for Kaluppa`} className="size-full object-contain" />
                      ) : payment.data ? (
                        <QRCodeSVG value={`${payment.data.qrPayload}:${provider}`} role="img" aria-label={`Sample ${provider} QR code`} className="size-full" />
                      ) : (
                        <Skeleton className="size-full" />
                      )}
                      {payment.data?.isSample && (
                        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-[4px] bg-danger px-2.5 py-1 text-xs font-bold tracking-[0.2em] text-white">SAMPLE</span>
                      )}
                    </div>
                    {payment.data?.isSample && <span className="text-xs text-ink-3">Kaluppa will replace this QR</span>}
                  </div>
                  <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
                    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                      <dt className="text-ink-3">Account name</dt>
                      <dd className="m-0 font-semibold">{payment.data?.accountName ?? '…'}</dd>
                      <dt className="text-ink-3">{provider} number</dt>
                      <dd className="m-0 font-semibold">{payment.data?.accountNumber ?? '…'}</dd>
                      <dt className="text-ink-3">Amount to pay</dt>
                      <dd className="m-0 text-lg font-bold text-roast">{formatPeso(total)}</dd>
                    </dl>
                    <ReceiptUpload value={receipt} onChange={(r) => setValue('receipt', r, { shouldValidate: Boolean(r) })} error={errors.receipt?.message} />
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-card bg-crema px-4 py-3.5">
                  <IconBanknote aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-roast" strokeWidth={1.9} />
                  <p className="m-0 text-[13.5px] leading-[1.6] text-ink-2">
                    {isDelivery ? `Please prepare ${formatPeso(total)} in cash for the rider. No receipt upload needed.` : `Pay ${formatPeso(total)} in cash at Kaluppa when you pick up your order.`}
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* 4 NOTE */}
          <Section
            n={4}
            muted
            title={
              <>
                Note <span className="text-[13px] font-normal text-ink-3">· optional</span>
              </>
            }
          >
            <div className="px-[22px] py-5">
              <label htmlFor="note" className="sr-only">Note for Kaluppa</label>
              <textarea
                id="note"
                rows={3}
                placeholder="Anything we should know? e.g. landmark or best time to deliver"
                aria-invalid={Boolean(errors.note) || undefined}
                className={cn(inputClasses, 'resize-y py-2.5')}
                {...register('note')}
              />
              <FieldHint error={errors.note?.message} />
            </div>
          </Section>
        </form>

        {/* SUMMARY */}
        <aside aria-labelledby="summary-title" className="min-w-0 max-w-[420px] flex-[1_1_340px] overflow-hidden rounded-card border border-sand bg-white max-lg:max-w-none">
          <header className="border-b border-sand-soft bg-cream px-[22px] py-[18px]">
            <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{lines.length === 1 ? '1 item' : `${lines.length} items`}</span>
            <h2 id="summary-title" className="mt-0.5 text-lg font-semibold">
              Order summary
            </h2>
          </header>
          <ul className="m-0 list-none px-[22px] py-2">
            {lines.map(({ product, quantity, lineTotalCentavos }) => (
              <li key={product._id} className="flex gap-3 border-b border-sand-soft py-3">
                <span aria-hidden="true" className="size-12 shrink-0 overflow-hidden rounded-[6px] bg-photo">
                  {product.image && <img src={imageUrl(product.image, 64)} alt="" loading="lazy" className="size-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold">{product.name}</span>
                  <span className="block text-xs text-ink-3">
                    {quantityWords(quantity, product.unit)} × {formatPeso(product.priceCentavos)}
                  </span>
                </div>
                <span className="text-[13.5px] font-semibold">{formatPeso(lineTotalCentavos)}</span>
              </li>
            ))}
          </ul>
          <div className="px-[22px] pb-[22px] pt-4">
            <div className="flex justify-between text-sm text-ink-2">
              <span>Subtotal</span>
              <span>{formatPeso(subtotalCentavos)}</span>
            </div>
            <div className="mt-1.5 flex justify-between gap-3 text-sm text-ink-2">
              <span>{isDelivery ? `Delivery fee${quote ? ` · ${quote.distanceKm} km` : ''}` : 'Pickup'}</span>
              <span>{isDelivery ? (quote ? formatPeso(feeCentavos) : '—') : 'Free'}</span>
            </div>
            <div className="mt-3.5 flex items-baseline justify-between border-t border-sand pt-3.5">
              <span className="text-[15px] font-semibold">Total</span>
              <span className="text-2xl font-semibold">{formatPeso(total)}</span>
            </div>
            <dl className="m-0 mt-4 flex flex-col gap-2.5 rounded-[6px] bg-crema px-3.5 py-3 text-[13px] text-ink-2">
              <SummaryRow icon={IconMapPin} label="Destination">{destination}</SummaryRow>
              <SummaryRow icon={IconCalendar} label="Estimated arrival">
                <strong>{eta ? `${isDelivery ? 'Estimated delivery' : 'Ready for pickup'} ${etaText(eta)}` : isDelivery ? 'Estimated delivery' : 'Ready for pickup'}</strong>
                <span className="block text-xs text-ink-3">
                  {delivery.data.eta.minBusinessDays}–{delivery.data.eta.maxBusinessDays} business days after Kaluppa confirms
                </span>
              </SummaryRow>
              <SummaryRow icon={IconWallet} label="Payment">{ewallet ? `${provider} · receipt required` : cashLabel}</SummaryRow>
            </dl>
            {blockedReason && (
              <p role="alert" className="mt-4 flex items-start gap-2 rounded-control border border-notice-line bg-notice-bg px-2.5 py-2 text-[12.5px] text-caramel-badge">
                <IconTriangleAlert aria-hidden="true" className="mt-px size-[15px] shrink-0" strokeWidth={2} />
                <span>
                  {blockedReason}{' '}
                  {!canCheckout && (
                    <Button variant="link" onClick={showCart} className="h-auto p-0 text-[length:inherit] underline">
                      Open your cart
                    </Button>
                  )}
                </span>
              </p>
            )}
            <Button type="submit" size="lg" fullWidth form="checkout" disabled={Boolean(blockedReason)} className="mt-4 h-[52px]">
              Place order
            </Button>
            <p className="mt-3 text-xs leading-[1.6] text-ink-3">
              You’ll be asked to confirm. Kaluppa confirms within 3 days; if not, the order expires{ewallet ? ' and your payment is refunded.' : '.'}
            </p>
          </div>
        </aside>
      </div>

      {addingAddress && (
        <AddressFormModal user={user} onClose={() => setAddingAddress(false)} onSaved={(saved) => setValue('addressId', saved._id, { shouldValidate: true })} />
      )}
      <PlaceOrderDialog open={confirming} onClose={() => setConfirming(false)} onConfirm={confirm} pending={place.isPending} rows={rows} ewallet={ewallet} />
    </CheckoutShell>
  )
}

function CheckoutShell({ children }) {
  const showCart = useCartDrawer((s) => s.show)
  return (
    <>
      <div className="mx-auto max-w-[1280px] px-4 pt-8 sm:px-8">
        <Button variant="bare" onClick={showCart} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-ink-3 hover:text-roast">
          ← Back to cart
        </Button>
        <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Order</div>
        <h1 className="mt-2.5 text-[28px] font-medium tracking-[-0.02em] sm:text-4xl">Checkout</h1>
      </div>
      <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-7 sm:px-8">{children}</div>
    </>
  )
}
