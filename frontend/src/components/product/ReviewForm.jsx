import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Star } from '@/components/ui/StarRating'
import { useAuth } from '@/hooks/useAuth'
import { useMyReview, useSaveReview } from '@/hooks/useProducts'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/date'
import { reviewSchema } from '@/schemas/review.schema'

const card = 'rounded-card border border-sand bg-white p-6'

function ReceivedNote({ order }) {
  const on = order?.soldAt ? ` on ${formatDate(order.soldAt).replace(/, \d{4}$/, '')}` : ''
  return order?.method === 'delivery' ? `This was delivered to you${on}, so you can review it.` : `You picked this up${on}, so you can review it.`
}

/** "Write a review" card: sign-in prompt for guests, the form once the buyer has a completed order. */
export function ReviewForm({ productId }) {
  const { isAuthenticated, mustVerify } = useAuth()
  const requireAuth = useRequireAuthAction()
  const mine = useMyReview(productId)

  if (!isAuthenticated || mustVerify) {
    return (
      <div className={card}>
        <h3 className="m-0 text-base font-semibold">Write a review</h3>
        <p className="mt-1.5 text-[12.5px] text-ink-3">Bought this coffee? Sign in to share how it tasted.</p>
        <Button className="mt-3.5 w-full" onClick={() => requireAuth(() => {})}>Write a review</Button>
      </div>
    )
  }
  if (mine.isPending) return <div className={card}><Skeleton className="h-4 w-1/2" /><Skeleton className="mt-3 h-24 w-full" /></div>
  if (mine.isError) return null
  const { review, canReview, order } = mine.data
  if (!review && !canReview) {
    return (
      <div className={card}>
        <h3 className="m-0 text-base font-semibold">Write a review</h3>
        <p className="mt-1.5 text-[12.5px] text-ink-3">You can review this coffee once an order with it is completed.</p>
      </div>
    )
  }
  return <ReviewEditor productId={productId} review={review} order={order} />
}

function ReviewEditor({ productId, review, order }) {
  const save = useSaveReview(productId)
  const { control, register, handleSubmit, setError, reset, formState: { errors } } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: review?.rating ?? 5, comment: review?.comment ?? '' },
  })
  useEffect(() => reset({ rating: review?.rating ?? 5, comment: review?.comment ?? '' }), [review, reset])

  const onSubmit = (values) =>
    save.mutate(
      { ...values, reviewId: review?._id },
      {
        onSuccess: () => toast.success(review ? 'Your review was updated.' : 'Thanks for your review.'),
        onError: (error) => {
          if (!applyServerErrors(error, setError, ['rating', 'comment'])) toast.error(errorMessage(error))
        },
      },
    )

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className={card}>
      <h3 className="m-0 text-base font-semibold">{review ? 'Your review' : 'Write a review'}</h3>
      <p className="mt-1.5 text-[12.5px] text-ink-3">{review ? 'You can edit your review anytime.' : <ReceivedNote order={order} />}</p>
      <Controller
        name="rating"
        control={control}
        render={({ field }) => (
          <fieldset className="m-0 mt-4 border-0 p-0">
            <legend className="p-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Your rating</legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i} ${i === 1 ? 'star' : 'stars'}`}
                  aria-pressed={i === field.value}
                  onClick={() => field.onChange(i)}
                  className="grid size-10 cursor-pointer place-items-center border-0 bg-transparent p-0"
                >
                  <Star filled={i <= field.value} className="size-[26px]" />
                </button>
              ))}
            </div>
            <FieldHint error={errors.rating?.message} />
          </fieldset>
        )}
      />
      <Label htmlFor="review-comment" className="mt-4">Your review</Label>
      <textarea
        id="review-comment"
        rows={4}
        placeholder="How did it taste? How did you brew it?"
        aria-invalid={errors.comment ? true : undefined}
        aria-describedby={errors.comment ? 'review-comment-error' : undefined}
        className={cn(inputClasses, 'mt-2 resize-y py-2.5')}
        {...register('comment')}
      />
      <FieldHint id="review-comment-error" error={errors.comment?.message} />
      <Button type="submit" pending={save.isPending} className="mt-3.5 w-full">{review ? 'Update review' : 'Post review'}</Button>
    </form>
  )
}
