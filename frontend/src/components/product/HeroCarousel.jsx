import { Button } from '@/components/ui/Button'
import { fillPayments } from '@/lib/payments'
import { usePaymentProviders } from '@/hooks/useSettings'
import Autoplay from 'embla-carousel-autoplay'
import useEmblaCarousel from 'embla-carousel-react'
import { IconArrowRight, IconChevronLeft, IconChevronRight } from '@/components/ui/icons'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BeanMark } from '@/components/ui/BeanMark'
import { CoffeeBranch, Contours } from '@/components/ui/Contours'
import { cn } from '@/lib/cn'
import { imageSrcSet, imageUrl } from '@/lib/image'

/** Shown while the slides load or if Kaluppa has none (the screen's first slide). */
const FALLBACK = [{
  title: 'Marinduque coffee, delivered to your door.',
  subtitle: 'Green beans, fresh roasts and grounds from local farms. Order online, pay by {payments}, and get it anywhere in Marinduque in 3–5 business days.',
  ctaLabel: 'Browse coffee',
  ctaHref: '/products',
  image: null,
}]

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const pad = (n) => String(n).padStart(2, '0')
const roundButton = 'size-11 rounded-full border-white/30 bg-white/8 hover:bg-white/15'

/** Landing hero: slides from settings, arrows, dots, "01 / 03", autoplay that pauses on hover and focus. */
export function HeroCarousel({ slides }) {
  const providers = usePaymentProviders()
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
    <section aria-roledescription="carousel" aria-label="Highlights" className="relative overflow-hidden bg-espresso">
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
                {slide.image && <img src={imageUrl(slide.image.url, 960)} srcSet={imageSrcSet(slide.image.url, [640, 1280, 1920, 2560])} sizes="100vw" alt="" className="size-full object-cover" fetchPriority={i === 0 ? 'high' : undefined} loading={i === 0 ? undefined : 'lazy'} />}
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
                  <p className="mx-auto mt-5 max-w-[620px] text-base leading-[1.65] text-white/85 sm:text-[17px]">{fillPayments(slide.subtitle, providers)}</p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Button as={Link} variant="light" size="lg" className="px-[22px] text-sm" to={slide.ctaHref} >
                      {slide.ctaLabel}
                      <IconArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
                    </Button>
                    <Button as="a" variant="glass" size="lg" className="border-white/30 px-[22px] text-sm font-medium hover:bg-white/15" href="#how" >
                      How ordering works
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {list.length > 1 && (
        <div className="absolute inset-x-0 bottom-9 z-[2] flex items-center justify-center gap-[18px]">
          <Button variant="glass" iconOnly aria-label="Previous slide" onClick={() => embla?.scrollPrev()} className={roundButton}>
            <IconChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </Button>
          <div className="flex items-center gap-2">
            {list.map((slide, i) => (
              <Button variant="bare"
                key={slide.title}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => embla?.scrollTo(i)}
                className="grid h-6 cursor-pointer place-items-center border-0 bg-transparent px-0"
              >
                <span className={cn('block h-1 rounded-full transition-all', i === index ? 'w-7 bg-caramel' : 'w-2 bg-white/40')} />
              </Button>
            ))}
          </div>
          <span aria-live="polite" className="text-xs tracking-[0.12em] text-white/75">{pad(index + 1)} / {pad(list.length)}</span>
          <Button variant="glass" iconOnly aria-label="Next slide" onClick={() => embla?.scrollNext()} className={roundButton}>
            <IconChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </Button>
        </div>
      )}
    </section>
  )
}

const titleClasses = 'mt-[22px] text-[36px] font-medium leading-[1.08] tracking-[-0.02em] text-white sm:text-[56px]'
