import { cn } from '@/lib/cn'

/** Uppercase label, text only (no bar — Change 02). `onDark` switches to the caramel-light text used on espresso. */
export function Eyebrow({ children, onDark = false, className }) {
  return (
    <div
      className={cn(
        'text-[11px] font-medium uppercase tracking-[0.16em]',
        onDark ? 'text-caramel-light' : 'text-ink-3',
        className,
      )}
    >
      {children}
    </div>
  )
}
