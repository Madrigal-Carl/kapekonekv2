import { Clock, Coffee, MapPin, ShoppingBag, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ReviewForm } from '@/components/product/ReviewForm'
import { ReviewList } from '@/components/product/ReviewList'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { QuantityStepper } from '@/components/ui/QuantityStepper'
import { Skeleton } from '@/components/ui/Skeleton'
import { StarRating } from '@/components/ui/StarRating'
import { COFFEE_TYPES, LOW_STOCK, VARIETIES } from '@/constants/catalog'
import { useAddToCart } from '@/hooks/useCart'
import { useProduct, useReviewSummary } from '@/hooks/useProducts'
import { cn } from '@/lib/cn'
import { formatPeso } from '@/lib/format'
import { stepFor } from '@/lib/quantity'
import { imageUrl } from '@/lib/image'

const pill = 'rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]'
const UNIT_NOUN = { kg: ['kg', 'kg'], pack: ['pack', 'packs'], piece: ['piece', 'pieces'] }
const STEP_HINT = { kg: 'In 0.5 kg steps', pack: 'Whole packs only', piece: 'Whole pieces only' }

function Gallery({ images, name }) {
  const [index, setIndex] = useState(0)
  const current = images[index]
  return (
    <div className="min-w-0 flex-[1_1_480px]">
      <div className="relative aspect-square overflow-hidden rounded-card border border-sand bg-photo">
        {current && <img src={imageUrl(current.url, 640)} alt={current.alt ?? name} className="size-full object-cover" />}
      </div>
      {images.length > 1 && (
        <div role="group" aria-label="Product photos" className="mt-3 grid grid-cols-4 gap-3">
          {images.slice(0, 8).map((image, i) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn('aspect-square cursor-pointer overflow-hidden rounded-[6px] border-2 bg-photo p-0', i === index ? 'border-roast' : 'border-sand')}
            >
              <img src={imageUrl(image.url, 96)} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Summary({ productId }) {
  const { data } = useReviewSummary(productId)
  if (!data) return <Skeleton className="h-40 rounded-card" />
  return (
    <div className="rounded-card border border-sand p-6">
      <div className="flex items-end gap-3">
        <span className="text-5xl font-semibold leading-none tracking-[-0.02em]">{data.count ? data.average.toFixed(1) : '–'}</span>
        <span className="pb-1 text-[13.5px] text-ink-3">out of 5 · {data.count} {data.count === 1 ? 'review' : 'reviews'}</span>
      </div>
      <ul className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = data.distribution[star] ?? 0
          return (
            <li key={star} className="flex items-center gap-2.5 text-[12.5px] text-ink-2">
              <span className="w-11">{star} star</span>
              <span aria-hidden="true" className="h-2 flex-1 overflow-hidden rounded-full bg-skeleton">
                <span className="block h-full rounded-full bg-caramel" style={{ width: `${data.count ? Math.round((n / data.count) * 100) : 0}%` }} />
              </span>
              <span className="w-[22px] text-right">{n}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Quantity, total and "Add to cart"; keyed by product so the quantity resets per product. */
function PurchasePanel({ product }) {
  const { add: addToCart, isPending: adding } = useAddToCart()
  const { priceCentavos, unit, stock } = product
  const out = stock <= 0
  const [quantity, setQuantity] = useState(stepFor(unit))
  return (
    <>
      {!out && (
        <div className="mt-7 flex flex-wrap items-end gap-5 border-t border-sand pt-6">
          <QuantityStepper value={quantity} onChange={setQuantity} unit={unit} stock={stock} hint={STEP_HINT[unit]} />
          <div className="flex-[1_1_160px]">
            <Eyebrow className="text-[10.5px] text-ink-2">Total</Eyebrow>
            <span className="mt-2 block text-[26px] font-semibold leading-[44px]">{formatPeso(Math.round(priceCentavos * quantity))}</span>
            <span className="mt-1.5 block text-xs text-ink-3">{quantity} × {formatPeso(priceCentavos)}</span>
          </div>
        </div>
      )}

      <Button onClick={() => addToCart(product, quantity)} disabled={out} pending={adding} className="mt-6 w-full py-[15px] text-[15px]">
        <ShoppingBag aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        {out ? 'Sold out' : 'Add to cart'}
      </Button>
    </>
  )
}

/** `/products/:slug` (ProductDetail.dc.html). */
export function ProductDetail() {
  const { slug } = useParams()
  const { data: product, isPending, isError, error, refetch } = useProduct(slug)

  if (isPending) {
    return (
      <main className="mx-auto flex max-w-[1280px] flex-wrap gap-12 px-4 py-12 sm:px-8">
        <Skeleton className="aspect-square min-w-0 flex-[1_1_480px] rounded-card" />
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-4"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-10 w-3/4" /><Skeleton className="h-24 w-full" /><Skeleton className="h-12 w-full" /></div>
      </main>
    )
  }
  if (isError) {
    const missing = error?.response?.status === 404
    return (
      <main className="mx-auto max-w-[720px] px-4 py-16">
        <EmptyState
          tone={missing ? 'neutral' : 'error'}
          icon={Coffee}
          title={missing ? "We couldn't find that coffee" : "We couldn't load this coffee"}
          action={missing ? <Button to="/products">Browse coffee</Button> : <Button variant="outline" onClick={() => refetch()}>Try again</Button>}
        >
          {missing ? 'It may have sold out for the season or moved.' : 'Check your connection and try again.'}
        </EmptyState>
      </main>
    )
  }

  const { _id, name, description, priceCentavos, unit, unitLabel, stock, images, ratingAverage, ratingCount, variety, coffeeType, category } = product
  const out = stock <= 0
  const [one, many] = UNIT_NOUN[unit] ?? [unit, unit]
  const stockLine = out ? 'Out of stock' : `${stock} ${stock === 1 ? one : many} available`

  return (
    <main>
      <div className="mx-auto max-w-[1280px] px-4 pt-6 sm:px-8">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-3">
          <Link to="/" className="text-ink-3 no-underline">Home</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <Link to="/products" className="text-ink-3 no-underline">{category.name}</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page" className="text-ink">{name}</span>
        </nav>
      </div>

      <section className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-12 px-4 pb-14 pt-6 sm:px-8">
        <Gallery images={images ?? []} name={name} />

        <div className="min-w-0 flex-[1_1_440px]">
          <div className="flex flex-wrap gap-2">
            <span className={cn(pill, 'bg-espresso text-crema')}>{category.name}</span>
            {VARIETIES[variety] && <span className={cn(pill, 'bg-caramel-tint text-caramel-badge')}>{VARIETIES[variety]}</span>}
            {COFFEE_TYPES[coffeeType] && <span className={cn(pill, 'border border-sand bg-foam text-ink-2')}>{COFFEE_TYPES[coffeeType].long}</span>}
          </div>
          <h1 className="mt-4 text-[30px] font-medium leading-[1.12] tracking-[-0.02em] sm:text-[38px]">{name}</h1>
          <a href="#reviews" className="mt-2.5 inline-flex items-center gap-2 text-[13.5px] text-ink-2 no-underline">
            <StarRating value={ratingAverage} label={false} starClassName="size-4" />
            {ratingCount > 0 ? (
              <span><strong className="text-ink">{ratingAverage.toFixed(1)}</strong> · {ratingCount} {ratingCount === 1 ? 'review' : 'reviews'}</span>
            ) : (
              <span>No reviews yet</span>
            )}
          </a>
          <p className="mt-[18px] text-[15px] leading-[1.7] text-ink-2">{description}</p>

          <div className="mt-6 flex items-baseline gap-2.5">
            <span className="text-[30px] font-semibold tracking-[-0.01em]">{formatPeso(priceCentavos)}</span>
            <span className="text-sm text-ink-3">per {one}{unitLabel ? ` · ${unitLabel}` : ''}</span>
          </div>
          <div className={cn('mt-2 inline-flex items-center gap-2 text-[13.5px]', out ? 'text-danger-ink' : stock <= LOW_STOCK ? 'text-caramel-badge' : 'text-success-ink')}>
            <span aria-hidden="true" className={cn('size-2 rounded-full', out ? 'bg-danger' : stock <= LOW_STOCK ? 'bg-caramel' : 'bg-success')} />
            {stockLine}
          </div>

          <PurchasePanel key={_id} product={product} />

          <ul className="m-0 mt-6 flex list-none flex-col gap-2.5 rounded-card bg-crema px-[18px] py-4 text-[13.5px] text-ink-2">
            <li className="flex items-start gap-2.5"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />Delivered anywhere in Marinduque, or pick up at Kaluppa in Pantayin, Santa Cruz.</li>
            <li className="flex items-start gap-2.5"><Wallet aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />Pay by GCash, Maya or cash on delivery.</li>
            <li className="flex items-start gap-2.5"><Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />Arrives in 3–5 business days after Kaluppa confirms your order.</li>
          </ul>
        </div>
      </section>

      <section id="reviews" className="mx-auto max-w-[1280px] scroll-mt-16 border-t border-sand px-4 pb-[88px] pt-16 sm:px-8">
        <Eyebrow>Reviews</Eyebrow>
        <h2 className="mt-3 text-[28px] font-medium tracking-[-0.02em] sm:text-[32px]">What buyers say</h2>
        <div className="mt-8 flex flex-wrap items-start gap-8">
          <div className="flex max-w-[380px] flex-[1_1_300px] flex-col gap-5 max-[700px]:max-w-none">
            <Summary productId={_id} />
            <ReviewForm productId={_id} />
          </div>
          <div className="min-w-0 flex-[999_1_520px]">
            <ReviewList productId={_id} total={ratingCount} />
          </div>
        </div>
      </section>
    </main>
  )
}
