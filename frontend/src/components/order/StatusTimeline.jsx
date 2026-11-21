import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Status history (OrderDetail.dc.html): done steps roast, the current step teal, upcoming grey.
 * @param {{ steps: Array<{ key: string, title: string, meta: string, done: boolean, current: boolean }> }} props
 */
export function StatusTimeline({ steps }) {
  return (
    <ol className="mt-4 list-none p-0">
      {steps.map((step, i) => {
        const next = steps[i + 1]
        return (
          <li key={step.key} className="flex gap-3.5" aria-current={step.current ? 'step' : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-[26px] shrink-0 place-items-center rounded-full border-2 text-white',
                  !step.done && 'border-sand-strong bg-white',
                  step.done && (step.current ? 'border-st-transit-dot bg-st-transit-dot' : 'border-roast bg-roast'),
                )}
              >
                {step.done && <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />}
              </span>
              {next && <span aria-hidden="true" className={cn('min-h-[26px] w-0.5 flex-1', next.done ? 'bg-roast' : 'bg-sand')} />}
            </div>
            <div className="pb-5">
              <p className={cn('mt-0.5 text-sm font-semibold', step.done ? 'text-ink' : 'text-ink-4')}>{step.title}</p>
              <p className="mt-0.5 text-[12.5px] text-ink-3">{step.meta}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
