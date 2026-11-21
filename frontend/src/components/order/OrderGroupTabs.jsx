import { groupCount, ORDER_GROUPS, ORDER_STATUS } from '@/constants/orderStatus'
import { cn } from '@/lib/cn'

/** Six group cards with counts (Orders.dc.html). Active card: 2px roast border, highlight bg, roast icon tile. */
export function OrderGroupTabs({ active, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Filter orders" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {ORDER_GROUPS.map(({ key, label, hint, statuses, icon: Icon }) => {
        const on = key === active
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(key)}
            className={cn(
              'flex cursor-pointer flex-col gap-2.5 rounded-card p-3.5 text-left text-ink',
              on ? 'border-2 border-roast bg-highlight shadow-tab-active' : 'border border-sand bg-white hover:bg-cream',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className={cn('grid size-[34px] place-items-center rounded-card', on ? 'bg-roast text-white' : 'bg-crema text-roast')}>
                <Icon aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
              </span>
              <span className={cn('text-[22px] font-semibold tracking-[-0.01em]', on ? 'text-roast' : 'text-ink')}>{counts ? groupCount(statuses, counts) : '–'}</span>
            </span>
            <span className="block">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-[1.4] text-ink-3">{hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** "All · Reserved · Processing" chips under a group with several statuses; the active chip is espresso-filled. */
export function StatusChips({ statuses, active, counts, onChange }) {
  const chips = [{ key: 'all', label: 'All', count: groupCount(statuses, counts) }, ...statuses.map((s) => ({ key: s, label: ORDER_STATUS[s].label, count: counts?.[s] ?? 0, dot: ORDER_STATUS[s].dot }))]
  return (
    <div role="group" aria-label="Filter by status" className="mt-3.5 flex flex-wrap gap-2">
      {chips.map((chip) => {
        const on = chip.key === active
        return (
          <button
            key={chip.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium',
              on ? 'border-espresso bg-espresso text-white' : 'border-sand-strong bg-white text-ink hover:bg-cream',
            )}
          >
            {chip.dot && <span aria-hidden="true" className={cn('size-[7px] rounded-full', chip.dot)} />}
            {chip.label} <span className="opacity-75">{chip.count}</span>
          </button>
        )
      })}
    </div>
  )
}
