import { BeanMark } from '@/components/ui/BeanMark'
import { cn } from '@/lib/cn'

/**
 * A product photo, or the KapeKonek default image when it has none (Change 08): espresso with the caramel bean mark.
 * `src` is the final (sized) URL; `className` sizes both the photo and the fallback.
 * @param {{ src?: string|null, alt?: string, className?: string, loading?: 'lazy'|'eager' }} props
 */
export function ProductImage({ src, alt = '', className, loading }) {
  if (src) return <img src={src} alt={alt} loading={loading} className={cn('object-cover', className)} />
  return (
    <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} data-default-image="" className={cn('grid place-items-center bg-espresso', className)}>
      <BeanMark className="size-[42%] max-h-24 max-w-24 text-caramel" />
    </span>
  )
}
