import { Button } from '@/components/ui/Button'
import { orList } from '@/lib/payments'
import { usePaymentProviders } from '@/hooks/useSettings'
import { IconArrowRight, IconBell, IconChevronDown, IconCoffee, IconMapPin, IconShoppingBag } from '@/components/ui/icons'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { HeroCarousel } from '@/components/product/HeroCarousel'
import { ProductCard } from '@/components/product/ProductCard'
import { Avatar, RoleBadge } from '@/components/ui/Avatar'
import { BeanMark } from '@/components/ui/BeanMark'
import { Contours } from '@/components/ui/Contours'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { ProductCardSkeleton, Skeleton } from '@/components/ui/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useTopPosts } from '@/hooks/usePosts'
import { useProducts } from '@/hooks/useProducts'
import { useLanding } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'
import { MediaStage } from '@/components/post/Media'

const VARIETY_CARDS = [
  { slug: 'liberica', name: 'Liberica', text: 'Large, uneven beans with a bold, smoky cup. The bean behind kapeng barako.' },
  { slug: 'excelsa', name: 'Excelsa', text: 'Tart and fruity with a lingering finish. Great on its own or in blends.' },
  { slug: 'arabica', name: 'Arabica', text: 'Smoother, brighter acidity and a lighter body. Best for pour-over.' },
  { slug: 'robusta', name: 'Robusta', text: 'Strong and earthy with more caffeine. Built for espresso and milk drinks.' },
]

const steps = (providers) => [
  { title: 'Add coffee to your cart', text: 'Filter by variety and type, then choose your quantity.' },
  { title: 'Choose delivery or pickup', text: 'Pick a saved address or add one with a map pin, or collect at Kaluppa.' },
  { title: 'Pay your way', text: providers.length ? `${orList(providers)} with a receipt upload, or cash on delivery.` : 'Cash on delivery or at pickup.' },
  { title: 'Get it in 3–5 business days', text: 'Kaluppa confirms, prepares and ships it. We notify you at every step.' },
]

const SELL = [
  { title: 'Create a farmer account', text: 'Sign up and choose “Farmer”. You can use your dashboard right away.' },
  { title: 'Join your group', text: 'Your Group Manager connects your farm to Kaluppa.' },
  { title: 'Sell your beans to Kaluppa', text: 'Deliver your harvest and track it from your dashboard.' },
]

const FEATURES = [
  { tag: 'Marketplace', title: 'Coffee straight from Kaluppa', text: 'Every product is sourced and sold by Kaluppa, labeled by variety and type.', icon: IconShoppingBag },
  { tag: 'Delivery', title: 'Delivered across Marinduque', text: 'Save your addresses with a map pin, see the fee upfront, and track every step.', icon: IconMapPin },
  { tag: 'Updates', title: 'Know where your order is', text: 'Email and in-app notifications at every step, from confirmation to delivery.', icon: IconBell },
]

const faqs = (providers) => [
  { q: 'How does delivery work?', a: 'Kaluppa delivers anywhere in Marinduque. Add your address (drop a pin or type it in), and the delivery fee is calculated from the road distance to Kaluppa in Pantayin, Santa Cruz.' },
  { q: 'How do I pay?', a: `By ${providers.length ? `${orList(providers)} (scan the QR at checkout and upload your receipt), or ` : ''}cash on delivery. Pickup orders can pay by e-wallet or in cash at Kaluppa.` },
  { q: 'When will my order arrive?', a: 'Usually 3–5 business days after Kaluppa confirms it. You’ll get an email and an in-app notification when it’s out for delivery.' },
  { q: 'What if Kaluppa doesn’t confirm my order?', a: 'Orders that aren’t confirmed within 3 days expire automatically. If you paid by e-wallet, your payment is marked for refund.' },
  { q: 'Can I cancel?', a: 'Yes, while your order is still pending. Pick a reason. E-wallet payments are refunded by Kaluppa.' },
]

const container = 'mx-auto max-w-[1280px] px-4 sm:px-8'
const section = 'py-16 sm:py-24'

function Featured() {
  const { isAuthenticated } = useAuth()
  const { data, isPending, isError } = useProducts({ category: 'coffee', featured: true, sort: 'popular', limit: 4 })
  const products = data?.pages[0].items ?? []
  return (
    <section className={cn(section, 'bg-white')}>
      <div className={container}>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <SectionHeading
            eyebrow="Featured"
            title="This week's roasts and green beans"
            lead="Picked by Kaluppa from the latest harvest. Stock is limited, so orders are confirmed first come, first served."
            className="max-w-[640px]"
          />
          <Link to="/products" className="inline-flex items-center gap-1.5 text-sm font-semibold text-roast no-underline">
            View all coffee
            <IconArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
          </Link>
        </div>
        <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
          {isPending && [1, 2, 3, 4].map((i) => <ProductCardSkeleton key={i} />)}
          {products.map((p) => <ProductCard key={p._id} product={p} featured />)}
        </div>
        {isError && <EmptyState tone="error" icon={IconCoffee} title="We couldn't load the featured coffee" action={<Link to="/products">Browse all coffee</Link>} />}
        {!isPending && !isError && !products.length && <EmptyState icon={IconCoffee} title="No featured coffee right now" action={<Link to="/products">Browse all coffee</Link>} />}
        {!isAuthenticated && <p className="mt-[18px] text-[12.5px] text-ink-4">Guests who tap “Add” are sent to sign in and brought back here.</p>}
      </div>
    </section>
  )
}

/** The Hub's 3 most-viewed posts of the last 30 days (Main.dc.html); the only posts guests and buyers can open. */
function TopPosts() {
  const { data: posts, isPending, isError } = useTopPosts()
  if (isError || (posts && !posts.length)) return null
  return (
    <section className={cn(section, 'bg-white')}>
      <div className={container}>
        <SectionHeading
          eyebrow="Most viewed this month"
          title="What the coffee community is reading"
          lead="The three most-viewed posts from the KapeKonek Hub this month. The rest of the Hub is for farmers, Group Managers and Kaluppa."
        />
        <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-6">
          {isPending && [1, 2, 3].map((i) => <Skeleton key={i} className="h-[380px] rounded-card" />)}
          {posts?.map((post) => {
            const cover = post.media.find((m) => m.type === 'image') ?? post.media[0]
            return (
              <article key={post._id} className="flex flex-col overflow-hidden rounded-card border border-sand bg-white transition-shadow hover:shadow-card-hover">
                <div className="flex items-center gap-3 p-4">
                  <Avatar person={post.author} className="size-10 text-[13px]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{post.author.name}</span>
                      <RoleBadge person={post.author} className="px-[7px] py-0.5 text-[10.5px]" />
                    </div>
                    <span className="text-xs text-ink-4">
                      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time> · {post.views.toLocaleString('en-PH')} views
                    </span>
                  </div>
                </div>
                <p className="mx-4 mb-3.5 mt-0 line-clamp-3 text-sm leading-[1.6] text-ink-2">{post.body}</p>
                {cover && <MediaStage item={cover} cover />}
                <Link to={`/posts/${post._id}`} className="mt-auto block px-4 py-3.5 text-[13px] font-semibold text-roast no-underline">
                  View post →<span className="sr-only"> by {post.author.name}</span>
                </Link>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const providers = usePaymentProviders()
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className={cn(section, 'scroll-mt-16 bg-crema')}>
      <div className="mx-auto max-w-[880px] px-4 sm:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions before you order" />
        <div className="mt-9 flex flex-col gap-2.5">
          {faqs(providers).map(({ q, a }, i) => {
            const isOpen = open === i
            return (
              <div key={q} className="rounded-card border border-sand bg-white">
                <h3 className="m-0">
                  <Button variant="bare"
                    id={`faq-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${i}-answer`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 border-0 bg-transparent px-5 py-[18px] text-left text-[15px] font-semibold text-ink"
                  >
                    {q}
                    <IconChevronDown aria-hidden="true" className={cn('size-[18px] shrink-0 text-roast transition-transform', isOpen && 'rotate-180')} strokeWidth={2} />
                  </Button>
                </h3>
                {isOpen && <p id={`faq-${i}-answer`} role="region" aria-labelledby={`faq-${i}`} className="m-0 px-5 pb-[18px] text-sm leading-[1.65] text-ink-2">{a}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** `/` — the storefront landing page (Main.dc.html). */
export function Landing() {
  const { isAuthenticated } = useAuth()
  const { data: landing } = useLanding()
  const providers = usePaymentProviders()
  return (
    <main>
      <HeroCarousel slides={landing?.heroSlides} />
      <Featured />

      <section className={cn(section, 'bg-crema')}>
        <div className={container}>
          <SectionHeading eyebrow="Four varieties" title="Know your bean before you brew" lead="Every KapeKonek coffee is labeled by variety, so you can filter for exactly what you like." />
          <div className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {VARIETY_CARDS.map((v, i) => (
              <Link
                key={v.slug}
                to={`/products?variety=${v.slug}`}
                className="block rounded-card border border-notice-line border-t-[3px] border-t-caramel bg-white p-6 no-underline transition-shadow hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-card bg-caramel-tint text-caramel-ink">
                    <BeanMark className="size-5" />
                  </span>
                  <span className="text-[10.5px] font-semibold tracking-[0.14em] text-caramel-ink">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold text-ink">{v.name}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-2">{v.text}</p>
                <span className="mt-3.5 inline-block text-[12.5px] font-semibold text-roast">Shop {v.name} →</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className={cn(section, 'scroll-mt-16 bg-white')}>
        <div className={container}>
          <SectionHeading eyebrow="How ordering works" title="Order online, delivered in 3–5 business days" />
          <ol className="m-0 mt-14 grid list-none grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-7 p-0">
            {steps(providers).map((s, i) => (
              <li key={s.title}>
                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-roast text-sm font-semibold text-white shadow-[0_0_0_5px_rgb(123_74_42/0.14)]">{i + 1}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-sand" />
                </div>
                <h3 className="mt-[18px] text-[15.5px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <TopPosts />

      <section className="relative overflow-hidden bg-espresso py-16 sm:py-[88px]">
        <Contours lines={3} className="h-[180px] text-crema/7" />
        <div className={cn(container, 'relative flex flex-wrap items-center gap-12')}>
          <div className="min-w-0 flex-[1_1_420px]">
            <SectionHeading onDark eyebrow="For farmers" title="Grow coffee? Sell your beans to Kaluppa." className="max-w-none" />
            <p className="mt-3.5 text-base leading-[1.65] text-white/82">Create a farmer account, join your group, and sell your harvest through KapeKonek. Fertilizer and seedlings are coming to your account soon.</p>
            <Button as={Link} variant="caramel" size="lg" className="mt-7 px-[22px] text-sm" to="/register" >
              Sign up as a farmer
            </Button>
          </div>
          <ol className="m-0 flex min-w-0 flex-[1_1_420px] list-none flex-col gap-3 p-0">
            {SELL.map((x, i) => (
              <li key={x.title} className="flex items-start gap-3.5 rounded-card border border-white/14 bg-white/5 p-[18px]">
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-caramel/60 text-[13px] font-semibold text-caramel-light">{i + 1}</span>
                <div>
                  <span className="block text-[15px] font-semibold text-white">{x.title}</span>
                  <span className="mt-1 block text-[13.5px] leading-[1.55] text-white/75">{x.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={cn(section, 'bg-white')}>
        <div className={container}>
          <SectionHeading eyebrow="What KapeKonek does" title="One place that connects farms, Kaluppa and coffee lovers" />
          <div className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-2">
            {FEATURES.map(({ tag, title, text, icon: Icon }) => (
              <div key={tag} className="flex items-start gap-4 rounded-card border border-transparent p-6 transition-shadow hover:shadow-card-hover">
                <span className="grid size-10 shrink-0 place-items-center rounded-card bg-roast/10 text-roast">
                  <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
                </span>
                <div>
                  <span className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-roast">{tag}</span>
                  <h3 className="mt-1 text-base font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-[1.6] text-ink-2">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Faq />

      {!isAuthenticated && <section className="bg-white py-16 sm:py-20">
        <div className={container}>
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-card border border-sand bg-white p-6 sm:p-10">
            <div className="max-w-[640px]">
              <h2 className="m-0 text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-ink sm:text-[30px]">Ready for your next bag?</h2>
              <p className="mt-2.5 text-[15px] leading-[1.6] text-ink-2">Create a free buyer account, verify your email, and place your first order.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button as={Link} size="lg" className="px-[22px] text-sm" to="/register" >Get started</Button>
              <Button as={Link} variant="outline" size="lg" className="border-sand px-[22px] text-sm font-medium" to="/products" >Browse coffee</Button>
            </div>
          </div>
        </div>
      </section>}
    </main>
  )
}
