import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { Star } from '@/components/ui/StarRating'
import { COFFEE_TYPES, LOW_STOCK, VARIETIES } from '@/constants/catalog'
import { useAddToCart } from '@/hooks/useCart'
import { formatPeso } from '@/lib/format'
import { imageUrl } from '@/lib/image'

const badge = 'absolute left-2.5 top-2.5 rounded-[4px] px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em]'

/**
 * Product tile (Main "Featured" and Products grid). `featured` shows the Featured badge and the shorter category line.
 * @param {{ product: object, featured?: boolean }} props
 */
export function ProductCard({ product, featured = false }) {
  const { add: addToCart } = useAddToCart()
  const { name, slug, shortDescription, priceCentavos, unit, stock, images, ratingAverage, ratingCount, variety, coffeeType, category } = product
  const href = `/products/${slug}`
  const out = stock <= 0
  const low = !out && stock <= LOW_STOCK
  const labels = [category?.name, VARIETIES[variety], !featured && COFFEE_TYPES[coffeeType]?.short].filter(Boolean)
  const image = images?.[0]

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-sand bg-white transition-shadow hover:shadow-card-hover">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="relative block aspect-[4/3] overflow-hidden bg-photo">
        {image && <img src={imageUrl(image.url, 320)} alt="" loading="lazy" className="size-full object-cover" />}
        {featured && <span className={`${badge} bg-espresso font-medium text-crema`}>Featured</span>}
        {!featured && out && (
          <>
            <span className="absolute inset-0 bg-white/55" />
            <span className={`${badge} border border-sand-strong bg-white text-sold-out-label`}>Out of stock</span>
          </>
        )}
        {!featured && low && <span className={`${badge} border border-notice-line bg-notice-bg text-caramel-badge`}>Only {stock} left</span>}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-[18px] pt-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-caramel-ink">{labels.join(' · ')}</span>
        <Link to={href} className="text-[15.5px] font-semibold leading-[1.3] text-ink no-underline hover:text-roast">{name}</Link>
        <p className="m-0 text-[13px] leading-[1.55] text-ink-3">{shortDescription}</p>
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Star className="size-3.5" filled={ratingCount > 0} />
          {ratingCount > 0 ? (
            <>
              <strong className="font-semibold">{ratingAverage.toFixed(1)}</strong>
              <span className="text-ink-4">({ratingCount}{featured ? ' reviews' : ''})</span>
            </>
          ) : (
            <span className="text-ink-4">No reviews yet</span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <div>
            <span className="text-[17px] font-semibold text-ink">{formatPeso(priceCentavos)}</span>
            <span className="text-[12.5px] text-ink-4"> / {unit}</span>
          </div>
          {out ? (
            <Button size="sm" disabled className="h-10 border-sold-out-bg bg-sold-out-bg font-medium text-sold-out-ink opacity-100 disabled:opacity-100">Sold out</Button>
          ) : (
            <Button
              size="sm"
              aria-label={`Add ${name} to cart`}
              onClick={() => addToCart(product)}
              leftIcon={<IconPlus aria-hidden="true" className="size-[15px]" strokeWidth={2} />}
              className="h-10 gap-1.5 font-medium"
            >
              Add
            </Button>
          )}
        </div>
      </div>
    </article>
  )
}
