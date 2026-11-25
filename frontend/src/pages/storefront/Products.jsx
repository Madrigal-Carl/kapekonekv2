import { IconRefresh, IconSearch } from '@/components/ui/icons'

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ProductCard } from '@/components/product/ProductCard'
import { Button } from '@/components/ui/Button'
import { ChipToggle } from '@/components/ui/ChipToggle'
import { EmptyState } from '@/components/ui/EmptyState'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { inputClasses } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { ProductCardSkeleton } from '@/components/ui/Skeleton'
import { COFFEE_TYPES, PRODUCT_SORTS, VARIETIES } from '@/constants/catalog'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useInfiniteSentinel } from '@/hooks/useInfiniteSentinel'
import { useProducts } from '@/hooks/useProducts'
import { cn } from '@/lib/cn'

const list = (value) => (value ? value.split(',').filter(Boolean) : [])
const legend = 'p-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2'
const SORTS = new Set(PRODUCT_SORTS.map((s) => s.value))

/** Text/number filter that edits locally and writes to the URL after a pause. */
function useDebouncedParam(params, setParam, key) {
  const [value, setValue] = useState(params.get(key) ?? '')
  const debounced = useDebouncedValue(value, 350)
  const urlValue = params.get(key) ?? ''
  useEffect(() => {
    if (debounced.trim() !== urlValue) setParam(key, debounced.trim())
    // Only push our own edits; URL changes are pulled in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  // Pull in URL changes made elsewhere (back button, "Clear all filters").
  const [seenUrl, setSeenUrl] = useState(urlValue)
  if (seenUrl !== urlValue) {
    setSeenUrl(urlValue)
    if (value.trim() !== urlValue) setValue(urlValue)
  }
  return [value, setValue]
}

/** `/products` — coffee list with URL-synced filters and infinite scroll (Products.dc.html). */
export function Products() {
  const [params, setParams] = useSearchParams()
  const setParam = (key, value) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === '' || value == null || (Array.isArray(value) && !value.length)) next.delete(key)
      else next.set(key, Array.isArray(value) ? value.join(',') : value)
      return next
    }, { replace: true })

  const variety = list(params.get('variety')).filter((v) => VARIETIES[v])
  const coffeeType = list(params.get('coffeeType')).filter((t) => COFFEE_TYPES[t])
  const sort = SORTS.has(params.get('sort')) ? params.get('sort') : 'newest'
  const [search, setSearch] = useDebouncedParam(params, setParam, 'search')
  const [minPrice, setMinPrice] = useDebouncedParam(params, setParam, 'minPrice')
  const [maxPrice, setMaxPrice] = useDebouncedParam(params, setParam, 'maxPrice')

  const toggle = (key, current, value) => setParam(key, current.includes(value) ? current.filter((x) => x !== value) : [...current, value])
  const filters = {
    category: 'coffee',
    search: params.get('search') || undefined,
    variety,
    coffeeType,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
    sort,
    limit: 9,
  }
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isPlaceholderData } = useProducts(filters)
  const products = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0].meta.total ?? 0

  const sentinel = useInfiniteSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage })

  const priceInput = (id, label, value, onChange, placeholder) => (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input id={id} inputMode="numeric" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} className={cn(inputClasses, 'min-w-0 py-2.5')} />
    </>
  )

  return (
    <main>
      <section className="border-b border-sand-soft bg-crema">
        <div className="mx-auto max-w-[1280px] px-4 pb-9 pt-10 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-3">
            <Link to="/" className="text-ink-3 no-underline">Home</Link>
            <span aria-hidden="true" className="mx-2">/</span>
            <span aria-current="page" className="text-ink">Coffee</span>
          </nav>
          <Eyebrow className="mt-[18px]">Shop</Eyebrow>
          <h1 className="mt-3 text-[34px] font-medium leading-[1.1] tracking-[-0.02em] sm:text-[40px]">Coffee</h1>
          <p className="mt-2.5 max-w-[640px] text-[15.5px] leading-[1.65] text-ink-2">
            Green beans, roasts and grounds from Marinduque farms. Delivered anywhere in Marinduque in 3–5 business days, or pick up at Kaluppa.
          </p>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1280px] flex-wrap items-start gap-8 px-4 py-8 sm:px-8">
        <aside aria-label="Filters" className="flex max-w-[300px] flex-[1_1_250px] flex-col gap-6 max-[600px]:max-w-none">
          <div>
            <label htmlFor="search" className={cn(legend, 'block')}>Search</label>
            <div className="relative mt-2">
              <IconSearch aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" strokeWidth={2} />
              <input id="search" type="search" placeholder="Search coffee" value={search} onChange={(e) => setSearch(e.target.value)} maxLength={80} className={cn(inputClasses, 'pl-9')} />
            </div>
          </div>
          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>Variety</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {Object.entries(VARIETIES).map(([value, label]) => (
                <ChipToggle key={value} pressed={variety.includes(value)} onClick={() => toggle('variety', variety, value)}>{label}</ChipToggle>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>Coffee type</legend>
            <div className="mt-2.5 flex flex-col gap-1">
              {Object.entries(COFFEE_TYPES).map(([value, { short }]) => (
                <label key={value} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-ink">
                  <input type="checkbox" checked={coffeeType.includes(value)} onChange={() => toggle('coffeeType', coffeeType, value)} className="size-[18px] accent-roast" />
                  {short}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="m-0 border-0 p-0">
            <legend className={legend}>Price (₱)</legend>
            <div className="mt-2.5 flex items-center gap-2">
              {priceInput('min', 'Minimum price', minPrice, setMinPrice, 'Min')}
              <span aria-hidden="true" className="text-ink-4">–</span>
              {priceInput('max', 'Maximum price', maxPrice, setMaxPrice, 'Max')}
            </div>
          </fieldset>
          <button type="button" onClick={() => setParams({}, { replace: true })} className="cursor-pointer self-start border-0 bg-transparent px-0 py-1.5 text-[13px] font-semibold text-roast">
            Clear all filters
          </button>
        </aside>

        <div className="min-w-0 flex-[999_1_560px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sand pb-4">
            <p aria-live="polite" className="m-0 text-[13.5px] text-ink-2">
              {isPending ? 'Loading coffee…' : <>Showing <strong className="font-semibold text-ink">{total}</strong> coffee {total === 1 ? 'product' : 'products'}</>}
            </p>
            <div className="flex items-center gap-2.5">
              <span aria-hidden="true" className="whitespace-nowrap text-[13px] text-ink-2">Sort by</span>
              <SearchSelect
                aria-label="Sort products by"
                icon="sort"
                size="sm"
                options={PRODUCT_SORTS}
                value={sort}
                onChange={(value) => setParam('sort', value === 'newest' ? '' : value)}
                placeholder="Newest"
                searchPlaceholder="Search sort options"
                className="w-[230px]"
              />
            </div>
          </div>

          {isError && (
            <EmptyState tone="error" icon={IconRefresh} title="We couldn't load the coffee" className="mt-10" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}>
              Check your connection and try again.
            </EmptyState>
          )}
          {data && !products.length && (
            <EmptyState icon={IconSearch} title="No coffee matches these filters" className="mt-10" action={<Button variant="outline" onClick={() => setParams({}, { replace: true })}>Clear all filters</Button>}>
              Try another variety or clear your filters.
            </EmptyState>
          )}

          <div className={cn('mt-6 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5 transition-opacity', isPlaceholderData && 'opacity-60')}>
            {products.map((p) => <ProductCard key={p._id} product={p} />)}
            {(isPending || isFetchingNextPage) && Array.from({ length: isPending ? 9 : 3 }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
          <div ref={sentinel} aria-hidden="true" />
          {isFetchingNextPage && <p aria-live="polite" className="mt-6 text-center text-[13px] text-ink-3">Loading more coffee…</p>}
        </div>
      </div>
    </main>
  )
}
