import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BeanMark } from '@/components/ui/BeanMark'
import { CoffeeBranch, Contours } from '@/components/ui/Contours'
import { cn } from '@/lib/cn'

/** Shown while the slides load or if Kaluppa has none (the screen's first slide). */
const FALLBACK = [{
  title: 'Marinduque coffee, delivered to your door.',
  subtitle: 'Green beans, fresh roasts and grounds from local farms. Order online, pay by GCash, Maya or cash on delivery, and get it anywhere in Marinduque in 3–5 business days.',
  ctaLabel: 'Browse coffee',
  ctaHref: '/products',
  image: null,
}]

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const pad = (n) => String(n).padStart(2, '0')
const roundButton = 'grid size-11 cursor-pointer place-items-center rounded-full border border-white/30 bg-white/8 text-white hover:bg-white/15'

/** Landing hero: slides from settings, arrows, dots, "01 / 03", autoplay that pauses on hover and focus. */
export function HeroCarousel({ slides }) {
  const list = slides?.length ? slides : FALLBACK
  const [viewportRef, embla] = useEmblaCarousel({ loop: true }, reducedMotion() ? [] : [Autoplay({ delay: 6000, stopOnMouseEnter: true, stopOnInteraction: false, stopOnFocusIn: true })])
  const [index, setIndex] = useState(0)

  const onSelect = useCallback(() => embla && setIndex(embla.selectedScrollSnap()), [embla])
  useEffect(() => {
    if (!embla) return undefined
    embla.on('select', onSelect).on('reInit', onSelect)
    return () => embla.off('select', onSelect).off('reInit', onSelect)
  }, [embla, onSelect])

  return (
    <section aria-roledescription="carousel" aria-label="Featured" className="relative overflow-hidden bg-espresso">
      <div ref={viewportRef} className="overflow-hidden">
        <div className="flex">
          {list.map((slide, i) => (
            <div
              key={slide.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${list.length}`}
              aria-hidden={i !== index}
              inert={i !== index}
              className="relative flex min-h-[560px] min-w-0 flex-[0_0_100%] items-center pb-[120px] pt-[72px] sm:min-h-[660px]"
            >
              <div aria-hidden="true" className="absolute inset-0 bg-espresso-2">
                {slide.image && <img src={slide.image.url} alt="" className="size-full object-cover" fetchPriority={i === 0 ? 'high' : undefined} />}
              </div>
              <div aria-hidden="true" className="absolute inset-0 bg-[image:var(--overlay-hero)]" />
              <Contours className="h-[220px] text-crema/9" />
              <CoffeeBranch className="text-caramel/32" />
              <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-4 sm:px-8">
                <div className="mx-auto max-w-[820px] text-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-caramel/45 bg-caramel/12 px-3.5 py-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-caramel-light">
                    <BeanMark className="size-3.5" />
                    Marinduque coffee · Sourced by Kaluppa
                  </span>
                  {i === 0 ? <h1 className={titleClasses}>{slide.title}</h1> : <h2 className={titleClasses}>{slide.title}</h2>}
                  <p className="mx-auto mt-5 max-w-[620px] text-base leading-[1.65] text-white/85 sm:text-[17px]">{slide.subtitle}</p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link to={slide.ctaHref} className="inline-flex items-center gap-2 rounded-control bg-crema px-[22px] py-[13px] text-sm font-semibold text-espresso no-underline hover:bg-white hover:text-espresso">
                      {slide.ctaLabel}
                      <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
                    </Link>
                    <a href="#how" className="inline-flex items-center gap-2 rounded-control border border-white/30 bg-white/10 px-[22px] py-[13px] text-sm font-medium text-white no-underline hover:bg-white/15 hover:text-white">
                      How ordering works
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {list.length > 1 && (
        <div className="absolute inset-x-0 bottom-9 z-[2] flex items-center justify-center gap-[18px]">
          <button type="button" aria-label="Previous slide" onClick={() => embla?.scrollPrev()} className={roundButton}>
            <ChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-2">
            {list.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => embla?.scrollTo(i)}
                className="grid h-6 cursor-pointer place-items-center border-0 bg-transparent px-0"
              >
                <span className={cn('block h-1 rounded-full transition-all', i === index ? 'w-7 bg-caramel' : 'w-2 bg-white/40')} />
              </button>
            ))}
          </div>
          <span aria-live="polite" className="text-xs tracking-[0.12em] text-white/75">{pad(index + 1)} / {pad(list.length)}</span>
          <button type="button" aria-label="Next slide" onClick={() => embla?.scrollNext()} className={roundButton}>
            <ChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      )}
    </section>
  )
}

const titleClasses = 'mt-[22px] text-[36px] font-medium leading-[1.08] tracking-[-0.02em] text-white sm:text-[56px]'
