import { cn } from '@/lib/cn'

// green = done/approved, amber = waiting, blue = in progress, roast = on the way, red = rejected, gray = closed (DESIGN §8.3)
const TONES = {
  green: ['bg-tone-green-bg text-tone-green-ink', 'bg-tone-green-dot'],
  amber: ['bg-tone-amber-bg text-tone-amber-ink', 'bg-tone-amber-dot'],
  blue: ['bg-tone-blue-bg text-tone-blue-ink', 'bg-tone-blue-dot'],
  roast: ['bg-tone-roast-bg text-tone-roast-ink', 'bg-tone-roast-dot'],
  red: ['bg-tone-red-bg text-tone-red-ink', 'bg-tone-red-dot'],
  gray: ['bg-tone-gray-bg text-tone-gray-ink', 'bg-tone-gray-dot'],
}

/** @param {{ tone: 'green'|'amber'|'blue'|'roast'|'red'|'gray', children: React.ReactNode }} props */
export function StatusPill({ tone, children }) {
  const [pill, dot] = TONES[tone]
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs font-semibold', pill)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', dot)} />
      {children}
    </span>
  )
}
