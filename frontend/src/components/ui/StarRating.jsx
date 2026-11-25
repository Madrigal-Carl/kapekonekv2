import { IconStar } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/** One star; `filled` decides the fill. */
export function Star({ filled = true, className }) {
  return (
    <IconStar aria-hidden="true" className={cn('size-3.5 stroke-caramel', filled ? 'fill-caramel' : 'fill-none', className)} strokeWidth={1.5} />
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
