import { IconCheck, IconMessageText, IconRefresh } from '@/components/ui/icons'

import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { StarRating } from '@/components/ui/StarRating'
import { useReviews } from '@/hooks/useProducts'
import { formatDate } from '@/lib/date'

const AVATAR_BG = ['bg-roast', 'bg-caramel-ink', 'bg-ink-2']
/** Newest-first reviews with "Load more reviews" (ProductDetail.dc.html). */
export function ReviewList({ productId, total }) {
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useReviews(productId)

  if (isPending) {
    return (
      <ul aria-label="Loading reviews" className="m-0 list-none p-0">
        {[1, 2, 3].map((i) => (
          <li key={i} className="flex gap-3 border-b border-sand-soft py-[22px]">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-1/3" /><Skeleton className="h-3 w-4/5" /></div>
          </li>
        ))}
      </ul>
    )
  }
  if (isError) {
    return (
      <EmptyState tone="error" icon={IconRefresh} title="We couldn't load the reviews" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>}>
        Check your connection and try again.
      </EmptyState>
    )
  }
  const reviews = data.pages.flatMap((p) => p.items)
  if (!reviews.length) {
    return <EmptyState icon={IconMessageText} title="No reviews yet">Buyers can review this coffee after their order is completed.</EmptyState>
  }

  return (
    <div>
      <ul className="m-0 flex list-none flex-col p-0">
        {reviews.map((review, i) => (
          <li key={review._id} className="border-b border-sand-soft py-[22px]">
            <div className="flex items-center gap-3">
              <Avatar person={review.author} bg={AVATAR_BG[i % AVATAR_BG.length]} className="size-10 text-[13px]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{review.author.name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold text-success-ink">
                    <IconCheck aria-hidden="true" className="size-3" strokeWidth={2.5} />
                    Verified purchase
                  </span>
                </div>
                <span className="text-xs text-ink-4">
                  {formatDate(review.createdAt)}
                  {review.editedAt && ' · Edited'}
                </span>
              </div>
              <StarRating value={review.rating} />
            </div>
            <p className="mb-0 ml-[52px] mt-3 text-sm leading-[1.65] text-ink-2">{review.comment}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col items-center gap-2">
        {hasNextPage && (
          <Button variant="outline" pending={isFetchingNextPage} onClick={() => fetchNextPage()} className="px-[22px] font-medium">
            Load more reviews
          </Button>
        )}
        <span className="text-[12.5px] text-ink-3">Showing {reviews.length} of {total}</span>
      </div>
    </div>
  )
}
