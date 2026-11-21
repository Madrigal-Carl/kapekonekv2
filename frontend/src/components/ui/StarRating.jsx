import { cn } from '@/lib/cn'

const POINTS = '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'

/** One star; `filled` decides the fill. */
export function Star({ filled = true, className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn('size-3.5 stroke-caramel', filled ? 'fill-caramel' : 'fill-none', className)} strokeWidth="1.5" strokeLinejoin="round">
      <polygon points={POINTS} />
    </svg>
  )
}

/** Five stars, rounded to the nearest whole star, read out as "4.5 out of 5 stars". */
export function StarRating({ value, className, starClassName, label = true }) {
  const filled = Math.round(value)
  return (
    <span role={label ? 'img' : undefined} aria-label={label ? `${value} out of 5 stars` : undefined} aria-hidden={label ? undefined : true} className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= filled} className={starClassName} />
      ))}
    </span>
  )
}
