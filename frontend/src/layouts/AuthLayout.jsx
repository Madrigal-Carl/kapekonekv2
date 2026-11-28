import { BeanMark } from '@/components/ui/BeanMark'
import { CoffeePlant, PanelContours } from '@/components/ui/Contours'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { useLanding } from '@/hooks/useSettings'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'

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
        <PanelContours lines={panel.lines ?? 3} />
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
