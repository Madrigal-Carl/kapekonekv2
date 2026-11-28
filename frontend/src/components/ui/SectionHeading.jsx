import { cn } from '@/lib/cn'
import { Eyebrow } from './Eyebrow'

/** Eyebrow + H2 + optional lead, as on the landing sections. */
export function SectionHeading({ eyebrow, title, lead, onDark = false, as: Tag = 'h2', id, className, children }) {
  return (
    <div className={cn('max-w-[680px]', className)}>
      <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>
      <Tag id={id} className={cn('mt-3.5 text-[30px] font-medium leading-[1.12] tracking-[-0.02em] sm:text-[38px]', onDark ? 'text-white' : 'text-ink')}>{title}</Tag>
      {lead && <p className={cn('mt-3 text-base leading-[1.65]', onDark ? 'text-white/82' : 'text-ink-2')}>{lead}</p>}
      {children}
    </div>
  )
}
