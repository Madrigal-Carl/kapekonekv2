import { IconCheck } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/** Pill toggle button (`aria-pressed`), e.g. the variety filter. */
export function ChipToggle({ pressed, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors',
        pressed ? 'border-roast bg-roast text-white' : 'border-sand-strong bg-white text-ink hover:bg-cream',
      )}
    >
      {pressed && <IconCheck aria-hidden="true" className="size-3.5" strokeWidth={2.25} />}
      {children}
    </button>
  )
}
