import { BeanMark } from '@/components/ui/BeanMark'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useLanding } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'

const CONTOURS = [
  'M-20 190 C 100 150, 260 230, 420 150',
  'M-20 166 C 100 126, 260 206, 420 126',
  'M-20 142 C 100 102, 260 182, 420 102',
  'M-20 118 C 100 78, 260 158, 420 78',
  'M-20 94 C 100 54, 260 134, 420 54',
]

function CoffeePlant() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 320" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute -right-2.5 bottom-0 h-[300px] text-caramel/30">
      <path d="M60 318 C 58 250, 72 190, 60 120 C 54 80, 62 40, 68 6" />
      <path d="M60 262 C 40 254, 24 236, 22 214 C 42 218, 58 236, 60 262Z" />
      <path d="M62 222 C 82 214, 98 196, 100 174 C 80 178, 64 196, 62 222Z" />
      <path d="M60 170 C 40 162, 26 144, 24 122 C 44 126, 58 144, 60 170Z" />
      <circle cx="70" cy="244" r="6" />
      <circle cx="80" cy="252" r="6" />
      <circle cx="48" cy="196" r="6" />
      <circle cx="40" cy="204" r="6" />
    </svg>
  )
}

/**
 * Split auth screen: espresso brand panel (hidden under 900px) + form column.
 * @param {{ panel: { eyebrow: string, title: string, text?: string, lines?: number, plant?: boolean }, width?: string, children: React.ReactNode }} props
 */
export function AuthLayout({ panel, width = 'max-w-[400px]', children }) {
  // The brand photo is the first landing slide's image (seeded media); the espresso base shows until it loads.
  const photo = useLanding().data?.heroSlides?.[0]?.image
  return (
    <main className="flex min-h-screen w-full bg-white">
      <section aria-hidden="true" className="relative flex min-h-screen flex-1 basis-1/2 flex-col justify-between overflow-hidden bg-espresso-2 px-12 py-10 max-[900px]:hidden">
        {photo && <img src={imageUrl(photo.url, 720)} alt="" className="absolute inset-0 size-full object-cover" />}
        <div className="absolute inset-0 bg-(image:--overlay-espresso)" />
        <svg viewBox="0 0 400 200" preserveAspectRatio="none" fill="none" className="absolute inset-x-0 bottom-0 h-[240px] w-full text-crema/10">
          {CONTOURS.slice(0, panel.lines ?? 3).map((d) => (
            <path key={d} d={d} stroke="currentColor" strokeWidth="1.5" />
          ))}
        </svg>
        {panel.plant && <CoffeePlant />}
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-card bg-crema/90 text-espresso">
            <BeanMark className="size-5" />
          </span>
          <span className="text-lg font-semibold text-white">KapeKonek</span>
        </div>
        <div className="relative max-w-[460px]">
          <Eyebrow onDark>{panel.eyebrow}</Eyebrow>
          <p className="mt-4 text-[32px] font-medium leading-[1.18] tracking-[-0.02em] text-white">{panel.title}</p>
          {panel.text && <p className="mt-3.5 text-[14.5px] leading-[1.65] text-white/78">{panel.text}</p>}
        </div>
      </section>

      <section className="flex min-h-screen min-w-0 flex-1 basis-1/2 items-center justify-center px-6 py-12">
        <div className={cn('w-full min-w-0', width)}>{children}</div>
      </section>
    </main>
  )
}

/** The page title block shared by the auth forms. */
export function AuthHeading({ eyebrow, title, children, className }) {
  return (
    <div className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">{title}</h1>
      {children && <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-2">{children}</p>}
    </div>
  )
}
