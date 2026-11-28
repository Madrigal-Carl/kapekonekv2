import { Button } from '@/components/ui/Button'
import { PERIODS } from '@/constants/periods'
import { cn } from '@/lib/cn'

/**
 * Overview date filter (DESIGN §8.2): "Showing this month · Nov 1 – Nov 30, 2026" and a white pill bar of 4 segments,
 * the active one espresso. Below 720px the bar stretches and the segments share the width.
 * @param {{ value: string, rangeText?: string, onChange: (period: string) => void }} props
 */
export function DateRangeSegmented({ value, rangeText, onChange }) {
  const label = PERIODS.find((p) => p.key === value)?.label.toLowerCase()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13.5px] text-ink-2">
        Showing <strong className="font-semibold text-ink">{label}</strong>
        {rangeText && ` · ${rangeText}`}
      </span>
      <div role="group" aria-label="Date range" className="inline-flex gap-0.5 rounded-card border border-sand bg-white p-1 max-[720px]:w-full">
        {PERIODS.map((p) => (
          <Button
            key={p.key}
            variant="bare"
            aria-pressed={p.key === value}
            onClick={() => onChange(p.key)}
            className={cn(
              'min-h-9 whitespace-nowrap rounded-md px-3.5 text-[13px] font-semibold max-[720px]:flex-1 max-[720px]:px-1.5',
              p.key === value ? 'bg-espresso text-white hover:text-white' : 'text-ink-2 hover:bg-crema hover:text-ink-2',
            )}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
