import { zodResolver } from '@hookform/resolvers/zod'
import { IconEdit, IconTrash } from '@/components/ui/icons'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { Star, StarRating } from '@/components/ui/StarRating'
import { useAuth } from '@/hooks/useAuth'
import { useDeleteReview, useMyReview, useSaveReview } from '@/hooks/useProducts'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/date'
import { reviewSchema } from '@/schemas/review.schema'

const card = 'rounded-card border border-sand bg-white p-6'
const smallButton = 'min-h-10 flex-1 px-3 py-[9px] text-[13px]'
const shortDate = (value) => formatDate(value).replace(/, \d{4}$/, '')

function Notice({ title, children }) {
  return (
    <div className={card}>
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-2">{children}</p>
    </div>
  )
}

/**
 * The review card beside the reviews list (ProductDetail.dc.html, Components.dc.html "Review panel states"):
 * guest, never ordered, ordered but not completed, write, your review (Edit / Delete with an inline confirm), edit.
 * The API decides eligibility (`/reviews/me`); this only shows it.
 */
export function ReviewPanel({ productId }) {
  const { isAuthenticated, mustVerify } = useAuth()
  const requireAuth = useRequireAuthAction()
  const mine = useMyReview(productId)
  const [editing, setEditing] = useState(false)

  if (!isAuthenticated || mustVerify) {
    return (
      <div className={card}>
        <h3 className="m-0 text-base font-semibold">Bought this?</h3>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-ink-2">Sign in to review it. Only buyers who received this product can leave a review.</p>
        <Button className="mt-3.5 w-full" onClick={() => requireAuth(() => {})}>
          {mustVerify ? 'Verify your email' : 'Sign in'}
        </Button>
      </div>
    )
  }
  if (mine.isPending) {
    return (
      <div className={card}>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-3 h-24 w-full" />
      </div>
    )
  }
  if (mine.isError) return null

  const { review, reason, order, pendingOrderNumber, pendingOrderId } = mine.data
  if (review && !editing) return <YourReview review={review} onEdit={() => setEditing(true)} />
  if (review) return <ReviewEditor productId={productId} review={review} onDone={() => setEditing(false)} />
  if (reason === 'not_completed') {
    return (
      <Notice title="Almost there">
        Your order <Link to={`/orders/${pendingOrderId}`} className="font-semibold underline underline-offset-2">{pendingOrderNumber}</Link> is on the way. You can review this after it’s completed.
      </Notice>
    )
  }
  if (reason) return <Notice title="Reviews are from buyers">You can review this once you’ve ordered it and the order is completed.</Notice>
  return <ReviewEditor productId={productId} order={order} />
}

function YourReview({ review, onEdit }) {
  const remove = useDeleteReview()
  const [confirming, setConfirming] = useState(false)
  const stamp = review.editedAt ? `Edited ${shortDate(review.editedAt)}` : `Posted ${shortDate(review.createdAt)}`

  const doDelete = () =>
    remove.mutate(review._id, {
      onSuccess: () => toast.success('Your review was deleted.'),
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <article aria-labelledby="your-review-title" className={card}>
      <div className="flex items-center justify-between gap-3">
        <h3 id="your-review-title" className="m-0 text-base font-semibold">Your review</h3>
        <span className="rounded-full border border-sand bg-cream px-2 py-0.5 text-[11px] font-semibold text-ink-2">{stamp}</span>
      </div>
      <StarRating value={review.rating} className="mt-3" />
      <p className="mt-2.5 whitespace-pre-line text-sm leading-[1.65] text-ink-2">{review.comment}</p>
      {confirming ? (
        <div role="alertdialog" aria-labelledby="delete-review-q" aria-describedby="delete-review-d" className="mt-4 rounded-[6px] border border-danger-line bg-danger-soft p-3.5">
          <p id="delete-review-q" className="m-0 text-[13.5px] font-semibold text-danger-text">Delete your review?</p>
          <p id="delete-review-d" className="mt-1 text-[12.5px] text-danger-text">
            It comes off the product page and the rating is recounted. You can write a new one later.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" autoFocus onClick={() => setConfirming(false)} className={smallButton}>
              Keep it
            </Button>
            <Button onClick={doDelete} pending={remove.isPending} className={cn(smallButton, 'bg-danger-ink font-semibold hover:bg-danger-text')}>
              Delete review
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={onEdit} className={smallButton}>
            <IconEdit aria-hidden="true" className="size-[15px] text-roast" strokeWidth={2} />
            Edit
          </Button>
          <Button variant="outline" onClick={() => setConfirming(true)} className={cn(smallButton, 'text-danger-ink hover:text-danger-ink')}>
            <IconTrash aria-hidden="true" className="size-[15px]" strokeWidth={2} />
            Delete
          </Button>
        </div>
      )}
    </article>
  )
}

function ReceivedNote({ order }) {
  if (!order) return null
  const on = order.soldAt ? ` on ${shortDate(order.soldAt)}` : ''
  const number = order.orderNumber ? ` (order ${order.orderNumber})` : ''
  return `You received this${on}${number}, so you can review it.`
}

/** Write a review, or edit yours (`review` + `onDone`: Cancel / Save changes). */
function ReviewEditor({ productId, review, order, onDone }) {
  const save = useSaveReview(productId)
  const { control, register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: review?.rating ?? 5, comment: review?.comment ?? '' },
  })
  const comment = useWatch({ control, name: 'comment' })

  const onSubmit = (values) =>
    save.mutate(
      { ...values, reviewId: review?._id },
      {
        onSuccess: () => {
          toast.success(review ? 'Your review was updated.' : 'Thanks for your review.')
          onDone?.()
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError, ['rating', 'comment'])) toast.error(errorMessage(error))
        },
      },
    )

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className={card}>
      <h3 className="m-0 text-base font-semibold">{review ? 'Edit your review' : 'Write a review'}</h3>
      {!review && (
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          <ReceivedNote order={order} />
        </p>
      )}
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
        maxLength={1000}
        placeholder="How did it taste? How did you brew it?"
        aria-invalid={errors.comment ? true : undefined}
        aria-describedby={errors.comment ? 'review-comment-error review-comment-count' : 'review-comment-count'}
        className={cn(inputClasses, 'mt-2 resize-y py-2.5')}
        {...register('comment')}
      />
      <div className="flex items-start justify-between gap-3">
        <FieldHint id="review-comment-error" error={errors.comment?.message} />
        <span id="review-comment-count" className="ml-auto mt-1 text-[11.5px] tabular-nums text-ink-3">{comment.length} / 1000</span>
      </div>
      <div className="mt-2.5 flex gap-2">
        {review && (
          <Button variant="outline" onClick={onDone} className="flex-1">
            Cancel
          </Button>
        )}
        <Button type="submit" pending={save.isPending} className="flex-[2]">
          {review ? 'Save changes' : 'Post review'}
        </Button>
      </div>
    </form>
  )
}
