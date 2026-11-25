import { format } from 'date-fns'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { StarRating } from '@/components/ui/StarRating'
import { avatarFor, initialsOf } from '@/constants/records'
import { useAdminReview, useAdminReviews, useHideReview, useReviewedProducts, useUnhideReview } from '@/hooks/useReviewModeration'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { NotFound } from '@/pages/errors/NotFound'
import { DashPage } from '../overview/Overview'
import { excerpt, productLine } from './reviewText'
import { ReviewView } from './ReviewView'

const PAGE_SIZE = 10
const STATUS = { label: 'Status', options: [{ value: '', label: 'All' }, { value: 'visible', label: 'Visible' }, { value: 'hidden', label: 'Hidden' }] }
const RATING_FILTER = {
  key: 'rating',
  label: 'Rating',
  options: [{ value: '', label: 'All ratings' }, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ${n === 1 ? 'star' : 'stars'}` }))],
}
const REPLY_FILTER = { key: 'reply', label: 'Reply', options: [{ value: '', label: 'Any reply status' }, { value: 'needs', label: 'Needs reply' }, { value: 'replied', label: 'Replied' }] }

const toRow = (r) => ({
  id: r.id,
  label: r.product?.name ?? 'review',
  product: { main: r.product?.name ?? 'Deleted product', sub: productLine(r.product) },
  reviewer: {
    name: r.reviewer?.name ?? 'Deleted account',
    sub: r.reviewer?.role === 'farmer' ? 'Farmer' : 'Buyer',
    initials: initialsOf(r.reviewer?.name ?? '?'),
    avatarClassName: avatarFor(r.reviewer?.id),
  },
  rating: r.rating,
  text: excerpt(r.comment),
  reply: r.reply ? { label: 'Replied', tone: 'green' } : { label: 'Needs reply', tone: 'amber' },
  status: r.hidden ? { label: 'Hidden', tone: 'gray' } : { label: 'Visible', tone: 'blue' },
  date: format(new Date(r.createdAt), 'MMM d, yyyy'),
  actions: r.hidden ? ['view', 'unhide'] : ['view', 'hide'],
})

const ratingCell = (n) => (
  <span className="flex flex-col">
    <StarRating value={n} starClassName="size-3.5" />
    <span className="text-xs text-ink-3">{n} of 5</span>
  </span>
)

/** Buyer and farmer reviews for Kaluppa (Reviews.dc.html): table, review drawer with the reply, hide modal. */
export function Reviews() {
  const query = useTableParams()
  const { params, set } = query
  const list = useAdminReviews({ status: params.status, product: params.product, rating: params.rating, reply: params.reply, q: params.q, page: params.page, limit: PAGE_SIZE })
  const products = useReviewedProducts()
  const opened = useAdminReview(params.open)
  const hide = useHideReview()
  const unhide = useUnhideReview()
  const [hiding, setHiding] = useState(null) // the review being hidden
  const close = () => set({ open: null, mode: null })

  const doUnhide = (id) => unhide.mutate(id, { onSuccess: () => toast.success('Review is visible again.'), onError: (e) => toast.error(errorMessage(e)) })
  const doHide = (reason) =>
    hide.mutate(
      { id: hiding.id, reason },
      {
        onSuccess: () => {
          toast.success('Review hidden. The reviewer was notified.')
          setHiding(null)
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    )
  const onAction = (action, row) => {
    if (action === 'view') return set({ open: row.id, mode: null })
    const review = list.data.items.find((r) => r.id === row.id)
    if (action === 'hide') setHiding(review)
    else doUnhide(review.id)
  }

  if (opened.error?.response?.status === 404) return <NotFound />

  return (
    <DashPage>
      <PageHeader
        eyebrow="Marketplace"
        title="Reviews"
        description="Buyer and farmer reviews of Kaluppa’s products. Reply publicly, or hide a review that breaks the rules. Kaluppa can’t edit what a reviewer wrote."
      />
      <DataTable
        query={query}
        ariaLabel="Reviews"
        columns={[
          { key: 'product', label: 'Product', kind: 'strong' },
          { key: 'reviewer', label: 'Reviewer', kind: 'person' },
          { key: 'rating', label: 'Rating', render: ratingCell },
          { key: 'text', label: 'Review', kind: 'muted', wrap: true },
          { key: 'reply', label: 'Reply', kind: 'pill' },
          { key: 'status', label: 'Status', kind: 'pill' },
          { key: 'date', label: 'Date', kind: 'muted' },
        ]}
        rows={list.data?.items.map(toRow)}
        status={STATUS}
        filters={[{ key: 'product', label: 'Product', options: [{ value: '', label: 'All products' }, ...(products.data ?? []).map((p) => ({ value: p.id, label: p.name }))] }, RATING_FILTER, REPLY_FILTER]}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{ title: 'No reviews yet', text: 'Reviews from buyers and farmers show up here after their orders are completed.' }}
        searchPlaceholder="Search product, reviewer or text"
        minWidth={1080}
        selectedId={params.open}
      />
      <ReviewView
        open={Boolean(params.open)}
        review={opened.data}
        onHide={() => setHiding(opened.data)}
        onUnhide={() => doUnhide(opened.data.id)}
        unhiding={unhide.isPending}
        onClose={close}
      />
      <ConfirmModal
        open={Boolean(hiding)}
        variant="hide"
        title="Hide this review?"
        confirmLabel="Hide review"
        cancelLabel="Cancel"
        reasonPlaceholder="e.g. Contains a phone number or offensive words"
        pending={hide.isPending}
        onClose={() => setHiding(null)}
        onConfirm={doHide}
      >
        It disappears from the product page and stops counting toward the rating. {hiding?.reviewer?.name.split(' ')[0] ?? 'The reviewer'} gets a notification
        with your reason. You can show it again later.
      </ConfirmModal>
    </DashPage>
  )
}
