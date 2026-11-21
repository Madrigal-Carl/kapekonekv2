import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { clampQuantity, stepFor } from '@/lib/quantity'

/** − value + stepper that respects the unit's step and the stock. */
export function QuantityStepper({ value, onChange, unit, stock, label = 'Quantity', hint }) {
  const id = useId()
  const step = stepFor(unit)
  const set = (next) => onChange(clampQuantity(next, unit, stock))
  const buttonClasses = 'grid size-11 cursor-pointer place-items-center bg-white text-ink disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div>
      <span id={id} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">{label}</span>
      <div role="group" aria-labelledby={id} className="mt-2 inline-flex items-center overflow-hidden rounded-control border border-sand-strong">
        <button type="button" aria-label="Decrease quantity" onClick={() => set(value - step)} disabled={value <= step} className={buttonClasses}>
          <Minus aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
        <output aria-live="polite" className="min-w-14 border-x border-sand text-center text-[15px] font-semibold leading-[44px]">{value}</output>
        <button type="button" aria-label="Increase quantity" onClick={() => set(value + step)} disabled={value + step > stock} className={buttonClasses}>
          <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </div>
  )
}
