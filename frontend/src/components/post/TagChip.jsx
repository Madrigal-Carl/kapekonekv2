import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/** `#tag` pill: picked = roast (espresso for the feed filter), the rest disable once 3 are picked (Hub.dc.html). */
export function TagChip({ tag, pressed, disabled, onClick, size = 'sm', tone = 'roast', children }) {
  const on = tone === 'roast' ? 'border-roast bg-roast text-white' : 'border-espresso bg-espresso text-white'
  return (
    <Button
      variant="bare"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 font-semibold disabled:opacity-45',
        size === 'sm' ? 'min-h-8 text-[12.5px]' : 'min-h-[34px] text-[13px]',
        pressed ? on : 'border-sand-strong bg-white text-ink hover:bg-cream',
      )}
    >
      {children ?? `#${tag}`}
    </Button>
  )
}
