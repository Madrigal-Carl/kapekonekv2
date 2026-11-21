import { cn } from '@/lib/cn'

export function Label({ className, ...props }) {
  return (
    <label
      className={cn('block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2', className)}
      {...props}
    />
  )
}

export const inputClasses =
  'w-full rounded-control border border-sand-strong bg-white px-3 py-[11px] text-sm text-ink outline-none placeholder:text-ink-4 focus:border-roast focus:ring-3 focus:ring-roast/18 aria-invalid:border-danger-strong'

/** Text input; pass `invalid` to mark it for assistive tech and style. */
export function Input({ className, invalid, ...props }) {
  return <input className={cn(inputClasses, className)} aria-invalid={invalid || undefined} {...props} />
}

/** Error or helper line under a field. */
export function FieldHint({ id, error, children, className }) {
  if (!error && !children) return null
  return (
    <p id={id} className={cn('mt-1.5 text-[12.5px]', error ? 'text-danger-ink' : 'text-ink-3', className)}>
      {error ?? children}
    </p>
  )
}
