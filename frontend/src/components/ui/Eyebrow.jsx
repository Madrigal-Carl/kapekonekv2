import { cn } from '@/lib/cn'

/** Caramel bar + uppercase label. `onDark` switches to the caramel-light text used on espresso. */
export function Eyebrow({ children, onDark = false, className }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.16em]',
        onDark ? 'text-caramel-light' : 'text-ink-3',
        className,
      )}
    >
      <span aria-hidden="true" className="h-[3px] w-6 rounded-full bg-caramel" />
      {children}
    </div>
  )
}
