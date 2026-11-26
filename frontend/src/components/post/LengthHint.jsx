import { cn } from '@/lib/cn'

const n = (value) => value.toLocaleString('en-PH')

/** "4,210 / 5,000" once the text nears its limit, red with the rule's message past it (matches `postBodyRule` / `commentBodyRule`). */
export function LengthHint({ id, value, max }) {
  const length = value.trim().length
  if (length < max * 0.8) return null
  const over = length > max
  return (
    <p id={id} aria-live="polite" className={cn('m-0 text-xs', over ? 'font-medium text-logout' : 'text-ink-3')}>
      {over && `Use ${n(max)} characters or fewer · `}
      {n(length)} / {n(max)}
    </p>
  )
}
