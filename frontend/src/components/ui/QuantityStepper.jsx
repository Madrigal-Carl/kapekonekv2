import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/cn'
import { clampQuantity, stepFor } from '@/lib/quantity'

/**
 * − value + stepper on the unit's step, capped at `max` (Product detail: stock − in cart; Cart: stock).
 * `+` is disabled at the cap; `capHint` replaces `hint` there.
 */
export function QuantityStepper({ value, onChange, unit, max, label = 'Quantity', hint, capHint }) {
  const id = useId()
  const step = stepFor(unit)
  const atCap = value + step > max + 1e-9
  const set = (next) => onChange(clampQuantity(next, unit, max))
  const buttonClasses = 'grid size-11 cursor-pointer place-items-center bg-white text-ink disabled:cursor-not-allowed'
  const shownHint = atCap && capHint ? capHint : hint
  return (
    <div>
      <span id={id} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">{label}</span>
      <div role="group" aria-labelledby={id} className="mt-2 inline-flex items-center overflow-hidden rounded-control border border-sand-strong">
        <button type="button" aria-label="Decrease quantity" onClick={() => set(value - step)} disabled={value <= step} className={cn(buttonClasses, 'disabled:opacity-40')}>
          <Minus aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
        <output aria-live="polite" className="min-w-14 border-x border-sand text-center text-[15px] font-semibold leading-[44px]">{value}</output>
        <button type="button" aria-label="Increase quantity" onClick={() => set(value + step)} disabled={atCap} className={cn(buttonClasses, 'disabled:bg-cream disabled:text-stepper-off')}>
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>
      {shownHint && (
        <span aria-live="polite" className={cn('mt-1.5 block max-w-[260px] text-xs', atCap && capHint ? 'text-caramel-badge' : 'text-ink-3')}>
          {shownHint}
        </span>
      )}
    </div>
  )
}
