import { format } from 'date-fns'
import { History } from '@/components/dashboard/History'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { DrawerLoading } from '@/pages/dashboard/orders/OrderParts'
import { Button } from '@/components/ui/Button'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { StarRating } from '@/components/ui/StarRating'
import { avatarFor, initialsOf } from '@/constants/records'
import { useDeleteReply, useSaveReply } from '@/hooks/useReviewModeration'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { ProductImage } from '@/components/product/ProductImage'
import { productLine, reviewTitle } from './reviewText'

const MAX_REPLY = 1000
const day = (iso) => format(new Date(iso), 'MMM d, yyyy')

function ReplyBox({ review }) {
  const id = useId()
  const save = useSaveReply()
  const remove = useDeleteReply()
  const [draft, setDraft] = useState(null) // null → showing the saved reply (if any)
  const editing = draft !== null || !review.reply
  const text = draft ?? ''

  const submit = () =>
    save.mutate(
      { id: review.id, body: text.trim() },
      { onSuccess: () => (setDraft(null), toast.success('Reply posted under the review.')), onError: (e) => toast.error(errorMessage(e)) },
    )
  const del = () => remove.mutate(review.id, { onSuccess: () => toast.success('Reply deleted.'), onError: (e) => toast.error(errorMessage(e)) })

  if (!editing) {
    const { reply } = review
    return (
      <div className="rounded-lg border-l-[3px] border-roast bg-crema px-4 py-3.5">
        <span className="flex justify-between gap-2.5 text-[12.5px] text-ink-3">
          <strong className="text-espresso">Kaluppa · {reply.by?.firstName ?? 'Team'}</strong>
          <span>{day(reply.editedAt ?? reply.at)}</span>
        </span>
        <p className="mb-0 mt-1.5 text-sm leading-[1.65]">{reply.body}</p>
        <div className="mt-2.5 flex gap-3.5">
          <Button variant="link" onClick={() => setDraft(reply.body)} className="text-[13px]">Edit reply</Button>
          <Button variant="link" onClick={del} loading={remove.isPending} className="text-[13px] text-logout hover:text-logout">Delete reply</Button>
        </div>
      </div>
    )
  }
  return (
    <div>
      <Label htmlFor={id}>
        Public reply <span className="normal-case tracking-normal text-ink-4">(shown under the review)</span>
      </Label>
      <textarea
        id={id}
        rows={4}
        maxLength={MAX_REPLY}
        value={text}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Thank the buyer, or explain what you’re doing about their feedback."
        aria-describedby={`${id}-hint`}
        className={cn(inputClasses, 'mt-2 resize-y px-[13px] py-2.5 leading-[1.55]')}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <FieldHint id={`${id}-hint`} className="mt-0 text-xs">{`${text.length} / ${MAX_REPLY} · the reviewer gets a notification`}</FieldHint>
        <div className="flex gap-2">
          {review.reply && <Button variant="outline" size="sm" onClick={() => setDraft(null)}>Cancel</Button>}
          <Button size="sm" onClick={submit} disabled={!text.trim()} loading={save.isPending}>Save reply</Button>
        </div>
      </div>
    </div>
  )
}

/**
 * One review for Kaluppa (ReviewView.dc.html): product, reviewer with the order, stars and text, the hidden banner,
 * and Kaluppa's public reply. What the reviewer wrote can't be edited here.
 * @param {{ open: boolean, review?: object, onHide: () => void, onUnhide: () => void, unhiding: boolean, onClose: () => void }} props
 */
export function ReviewView({ open, review, onHide, onUnhide, unhiding, onClose }) {
  return (
    <Drawer
      open={open}
      width={640}
      eyebrow="Review"
      title={review ? reviewTitle(review) : 'Loading…'}
      onClose={onClose}
      footer={
        review && (
          <>
            {review.hidden ? (
              <Button variant="outline" onClick={onUnhide} loading={unhiding}>Show again</Button>
            ) : (
              <Button variant="outline" onClick={onHide} className="text-logout hover:text-logout">Hide review</Button>
            )}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </>
        )
      }
    >
      {!review ? (
        <DrawerLoading />
      ) : (
        <>
          <div className="flex items-center gap-3.5 rounded-lg border border-sand p-3.5">
            <span aria-hidden="true" className="size-14 shrink-0 overflow-hidden rounded-md bg-photo">
              <ProductImage src={review.product?.image && imageUrl(review.product.image, 112)} className="size-full" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold">{review.product?.name ?? 'Deleted product'}</span>
              <span className="block text-[12.5px] text-ink-3">{productLine(review.product)}</span>
            </div>
            {review.product && (
              <Link to={`/dashboard/inventory?open=${review.product.id}&mode=edit`} className="text-[13px] font-semibold no-underline">View product</Link>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={cn('grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white', avatarFor(review.reviewer?.id))}>
              {initialsOf(review.reviewer?.name ?? '?')}
            </span>
            <div className="flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold">{review.reviewer?.name ?? 'Deleted account'}</span>
                <span className="rounded-full bg-tone-green-bg px-2 py-0.5 text-[11px] font-semibold text-tone-green-ink">Verified purchase</span>
                <span className="rounded-full border border-sand bg-cream px-2 py-px text-[11px] font-semibold text-ink-2">{review.reviewer?.role === 'farmer' ? 'Farmer' : 'Buyer'}</span>
              </span>
              <span className="block text-[12.5px] text-ink-3">
                {day(review.createdAt)}
                {review.order && (
                  <>
                    {' · order '}
                    <Link to={`/dashboard/orders?open=${review.order.id}`} className="font-semibold">{review.order.orderNumber}</Link>
                  </>
                )}
              </span>
            </div>
          </div>
          <div>
            <StarRating value={review.rating} starClassName="size-5" />
            <p className="mb-0 mt-2.5 text-[14.5px] leading-[1.7] text-espresso">{review.comment}</p>
          </div>
          {review.hidden && (
            <div role="status" className="rounded-lg border border-sand bg-tone-gray-bg px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">
              <strong>Hidden from the product page</strong> since {format(new Date(review.hidden.at), 'MMM d')} by {review.hidden.by.name}. Reason: “{review.hidden.reason}”. It
              doesn’t count toward the rating.
            </div>
          )}
          <h3 className="-mb-2 mt-2 border-t border-skeleton pt-[18px] text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Reply from Kaluppa</h3>
          <ReplyBox key={`${review.id}:${review.reply?.body ?? ''}`} review={review} />
          <History entityType="review" entityId={review.id} />
        </>
      )}
    </Drawer>
  )
}
