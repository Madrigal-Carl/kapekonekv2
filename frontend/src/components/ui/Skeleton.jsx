import { cn } from '@/lib/cn'

/** Pulsing placeholder block. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-[4px] bg-skeleton', className)} />
}

/** Product card placeholder (Products.dc.html). */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse overflow-hidden rounded-card border border-sand-soft bg-white">
      <div className="aspect-[4/3] bg-skeleton" />
      <div className="flex flex-col gap-2.5 p-4">
        <div className="h-2.5 w-[45%] rounded-[4px] bg-skeleton" />
        <div className="h-3.5 w-[80%] rounded-[4px] bg-skeleton" />
        <div className="h-2.5 w-[95%] rounded-[4px] bg-skeleton" />
        <div className="mt-2.5 h-9 w-full rounded-control bg-foam" />
      </div>
    </div>
  )
}
