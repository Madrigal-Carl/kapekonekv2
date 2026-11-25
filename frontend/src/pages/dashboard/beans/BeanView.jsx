import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { IconCheck, IconStore } from '@/components/ui/icons'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { DetailList, SectionTitle, TextField } from '@/components/dashboard/RecordParts'
import { MediaStage, MediaThumb } from '@/components/post/Media'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { BEAN_STATUS, beanTitle } from '@/constants/beans'
import { avatarFor, initialsOf } from '@/constants/records'
import { useApproveBean, useCompleteBean, useRejectBean } from '@/hooks/useBeans'
import { useDeliveryInfo } from '@/hooks/useSettings'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatKg, formatPesoShort } from '@/lib/format'
import { beanCompleteFormSchema } from '@/schemas/beans.schema'
import { cancelReasonRule } from '@/schemas/rules'

const day = (value) => format(new Date(value), 'MMM d')
const stamp = (value) => format(new Date(value), 'MMM d, h:mm a')
const first = (name = '') => name.split(' ')[0]
const ROLE = { kaluppa: 'Kaluppa', group_manager: 'Group Manager' }
const HISTORY = {
  listed: ['Listed', 'bg-tone-amber-dot'],
  approved: ['Approved', 'bg-tone-blue-dot'],
  rejected: ['Rejected', 'bg-tone-red-dot'],
  completed: ['Completed', 'bg-tone-green-dot'],
  cancelled: ['Cancelled', 'bg-tone-gray-dot'],
  expired: ['Expired', 'bg-tone-gray-dot'],
}
const BANNER_TONES = {
  amber: 'border-notice-line bg-notice-bg text-notice-ink',
  blue: 'border-tone-blue-line bg-tone-blue-bg text-tone-blue-ink',
  green: 'border-tone-green-line bg-tone-green-bg text-tone-green-ink',
  gray: 'border-sand bg-tone-gray-bg text-tone-gray-ink',
  red: 'border-danger-line bg-danger-soft text-danger-text',
}

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="aspect-[16/10] w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

/** The photos in a fixed 16:10 stage (contain) with square thumbnails, so a tall photo never changes the drawer. */
function Gallery({ photos }) {
  const [index, setIndex] = useState(0)
  const items = photos.map((p, i) => ({ type: 'image', url: p.url, alt: `Bean photo ${i + 1} of ${photos.length}` }))
  const current = items[Math.min(index, items.length - 1)]
  if (!current) return null
  return (
    <div>
      <MediaStage item={current} className="rounded-lg" />
      {items.length > 1 && (
        <div className="mt-2 grid grid-cols-5 gap-2">
          {items.map((item, i) => (
            <Button variant="bare"
              key={item.url + i}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn('relative aspect-square overflow-hidden rounded-md border-2 bg-photo focus-visible:outline-2 focus-visible:outline-roast', i === index ? 'border-roast' : 'border-sand')}
            >
              <MediaThumb item={item} />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function History({ listing, meId }) {
  return (
    <>
      <SectionTitle>History</SectionTitle>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {listing.history.map((h, i) => {
          const [title, dot] = HISTORY[h.action] ?? [h.action, 'bg-tone-gray-dot']
          const who = !h.by ? 'automatically' : `by ${h.by.id === meId ? 'you' : h.by.name}${ROLE[h.byRole] ? ` (${ROLE[h.byRole]})` : ''}`
          const extra = h.action === 'completed' && listing.completion ? ` · final ${formatKg(listing.completion.finalWeightKg)}, ${formatPesoShort(listing.completion.finalAmountCentavos)}` : ''
          return (
            <li key={`${h.action}-${i}`} className="flex gap-2.5 text-[13px]">
              <span aria-hidden="true" className={cn('mt-[5px] size-2.5 shrink-0 rounded-full', dot)} />
              <span>
                <strong>{title}</strong>
                <span className="block text-ink-3">{`${stamp(h.at)} ${who}${extra}`}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </>
  )
}

/** What the farmer (or their Group Manager) reads at the top of a listing (BeansFarmer.dc.html view banners). */
function sellerBanner(l, meId) {
  const cancelled = l.history.findLast((h) => h.action === 'cancelled')
  const byWhom = cancelled?.by?.id === meId ? 'you' : cancelled?.byRole === 'kaluppa' ? 'Kaluppa' : (cancelled?.by?.name ?? 'Kaluppa')
  const c = l.completion
  switch (l.status) {
    case 'pending':
      return { tone: 'amber', title: 'Waiting for Kaluppa to review', text: 'You can still edit or cancel this listing. You’ll get an email when Kaluppa decides.' }
    case 'approved':
      return {
        tone: 'blue',
        title: `Approved · bring your beans by ${day(l.expiresAt)}`,
        text: `Bring the beans to the Kaluppa branch within 7 days. Kaluppa weighs them and pays you there, then marks this listing completed. If not brought by ${day(l.expiresAt)}, it expires.`,
      }
    case 'completed':
      return {
        tone: 'green',
        title: `Completed on ${day(c.at)}`,
        text: `Final: ${formatKg(c.finalWeightKg)} for ${formatPesoShort(c.finalAmountCentavos)} (listed ${formatKg(l.weightKg)} for ${formatPesoShort(l.amountCentavos)}).${c.finalWeightKg !== l.weightKg ? ' Kaluppa adjusted the weight at the branch.' : ''}`,
      }
    case 'cancelled':
      return {
        tone: 'gray',
        title: `Cancelled by ${byWhom} on ${day(l.cancellation?.at ?? cancelled?.at)}`,
        text: [l.cancellation?.reason && `Reason: “${l.cancellation.reason}”`, 'Cancelled kilograms don’t count toward your limit.'].filter(Boolean).join(' '),
      }
    case 'expired':
      return { tone: 'gray', title: 'Expired', text: 'The beans weren’t brought within 7 days of approval.' }
    default:
      return { tone: 'red', title: 'Rejected', text: `Reason from Kaluppa: “${l.rejection?.reason}”` }
  }
}

/**
 * A listing as its farmer or Group Manager sees it (BeansFarmer.dc.html view drawer): status banner, branch box once
 * approved, photos, details and history. Cancel listing while pending or approved.
 * @param {{ open: boolean, listing: object | undefined, meId: string, onCancel: () => void, onClose: () => void }} props
 */
export function BeanView({ open, listing, meId, onCancel, onClose }) {
  const delivery = useDeliveryInfo()
  const branch = delivery.data?.pickup
  const canCancel = listing && (listing.status === 'pending' || listing.status === 'approved')
  const banner = listing && sellerBanner(listing, meId)
  return (
    <Drawer
      open={open}
      width={640}
      eyebrow={listing?.listingNumber ?? 'Listing'}
      title={listing ? beanTitle(listing) : 'Listing'}
      onClose={onClose}
      footer={
        <>
          {canCancel && <Button variant="danger-outline" onClick={onCancel}>Cancel listing</Button>}
          <Button variant="outline" onClick={onClose}>Close</Button>
        </>
      }
    >
      {!listing ? (
        <Loading />
      ) : (
        <>
          <div role="status" className={cn('rounded-lg border px-4 py-3.5', BANNER_TONES[banner.tone])}>
            <span className="block text-[14.5px] font-semibold">{banner.title}</span>
            <span className="mt-[3px] block text-[13px] leading-[1.6]">{banner.text}</span>
          </div>
          {listing.status === 'approved' && branch && (
            <div className="flex gap-3 rounded-lg border border-sand p-3.5">
              <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-lg bg-espresso text-caramel-light">
                <IconStore className="size-5" strokeWidth={1.75} />
              </span>
              <div className="text-[13.5px] leading-[1.6]">
                <strong>{branch.name} branch</strong>
                <br />
                {branch.address}
                <br />
                <span className="text-ink-3">{[branch.hours, branch.phone].filter(Boolean).join(' · ')}</span>
              </div>
            </div>
          )}
          <Gallery photos={listing.photos} />
          <DetailList
            rows={[
              { k: 'Farmer', v: listing.farmer.name },
              { k: 'Weight', v: formatKg(listing.weightKg) },
              { k: 'Your price', v: `${formatPesoShort(listing.pricePerKgCentavos)} per kg` },
              { k: 'Amount', v: formatPesoShort(listing.amountCentavos) },
              listing.note && { k: 'Note', v: listing.note },
              listing.recordedBy && listing.recordedBy.id !== listing.farmer.id && { k: 'Listed by', v: `${listing.recordedBy.name} (Group Manager)` },
            ]}
          />
          <History listing={listing} meId={meId} />
        </>
      )}
    </Drawer>
  )
}

/**
 * Kaluppa reviews a listing (BeansKaluppa.dc.html): approve, or reject with a reason; once the beans arrive, enter the
 * weight and amount from the branch and complete it. Cancel sale while approved.
 * @param {{ open: boolean, listing: object | undefined, onCancelSale: () => void, onClose: () => void }} props
 */
export function BeanReview({ open, listing, onCancelSale, onClose }) {
  const formId = useId()
  const approve = useApproveBean()
  const reject = useRejectBean()
  const complete = useCompleteBean()
  const [step, setStep] = useState(null) // 'rejecting' | 'completing'
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const reasonCheck = cancelReasonRule.safeParse(reason)
  const close = () => {
    setStep(null)
    setReason('')
    setTouched(false)
    onClose()
  }
  const done = (message) => () => {
    toast.success(message)
    close()
  }
  const onError = (error) => toast.error(errorMessage(error))
  const no = listing?.listingNumber

  const doApprove = () => approve.mutate(listing.id, { onSuccess: done(`${no} approved. ${first(listing.farmer.name)} has 7 days to bring the beans.`), onError })
  const doReject = () => {
    setTouched(true)
    if (reasonCheck.success) reject.mutate({ id: listing.id, reason: reasonCheck.data }, { onSuccess: done(`${no} rejected. The farmer was told your reason.`), onError })
  }
  const doComplete = ({ finalWeightKg, finalAmount }) =>
    complete.mutate({ id: listing.id, finalWeightKg, finalAmountCentavos: finalAmount }, { onSuccess: done(`${no} completed.`), onError })

  const s = listing?.status
  // Every footer button has its own key: if React reused the “Beans arrived” <button> as the submit button, the same
  // click would submit the weighing form before Kaluppa typed anything.
  const footer = !listing ? null : step === 'rejecting' ? (
    <>
      <Button key="back-reject" variant="outline" onClick={() => setStep(null)} >Back</Button>
      <Button key="reject-listing" variant="danger" onClick={doReject} loading={reject.isPending}>Reject listing</Button>
    </>
  ) : step === 'completing' ? (
    <>
      <Button key="back-complete" variant="outline" onClick={() => setStep(null)} >Back</Button>
      <Button variant="success" key="mark-completed" type="submit" form={formId} loading={complete.isPending}>Mark completed</Button>
    </>
  ) : s === 'pending' ? (
    <>
      <Button key="reject" variant="outline" onClick={() => setStep('rejecting')} className="min-h-[42px] py-0 font-semibold text-logout">Reject</Button>
      <Button variant="success" key="approve" onClick={doApprove} loading={approve.isPending}>
        <IconCheck aria-hidden="true" className="size-4" strokeWidth={2.25} />
        Approve
      </Button>
    </>
  ) : s === 'approved' ? (
    <>
      <Button key="cancel-sale" variant="danger-outline" onClick={onCancelSale}>Cancel sale</Button>
      <Button key="arrived" onClick={() => setStep('completing')} className="min-h-[42px] py-0">Beans arrived</Button>
    </>
  ) : (
    <Button variant="outline" onClick={close}>Close</Button>
  )

  const unapproved = listing?.countsTowardCap
  return (
    <Drawer
      open={open}
      width={640}
      eyebrow={listing ? `${no} · ${BEAN_STATUS[s].label}` : 'Listing'}
      title={listing ? beanTitle(listing) : 'Listing'}
      onClose={close}
      footer={footer}
    >
      {!listing ? (
        <Loading />
      ) : (
        <>
          <Gallery photos={listing.photos} />
          <div className="flex items-center gap-3 rounded-lg border border-sand p-3">
            <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white', avatarFor(listing.farmer.id))}>
              {initialsOf(listing.farmer.name)}
            </span>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{listing.farmer.name}</span>
              <span className="block text-xs text-ink-3">
                {unapproved ? `Unapproved farmer · ${listing.association ? `${listing.association.name} request pending` : 'no association yet'}` : (listing.association?.name ?? 'Approved farmer')}
              </span>
            </div>
            <span className={cn('rounded-full px-2.5 py-[3px] text-xs font-semibold', unapproved ? 'bg-tone-amber-bg text-tone-amber-ink' : 'bg-tone-green-bg text-tone-green-ink')}>
              {unapproved ? 'Within 5 kg limit' : 'Approved farmer'}
            </span>
          </div>
          <DetailList
            rows={[
              { k: 'Weight', v: formatKg(listing.weightKg) },
              { k: 'Asking price', v: `${formatPesoShort(listing.pricePerKgCentavos)} per kg` },
              { k: 'Amount', v: formatPesoShort(listing.amountCentavos) },
              { k: 'Listed', v: format(new Date(listing.createdAt), 'MMM d, h:mm a') },
              listing.note && { k: 'Farmer’s note', v: listing.note },
              s === 'approved' && { k: 'Expires', v: `${day(listing.expiresAt)} if not brought in` },
              s === 'completed' && { k: 'Final', v: `${formatKg(listing.completion.finalWeightKg)} for ${formatPesoShort(listing.completion.finalAmountCentavos)}` },
              s === 'rejected' && { k: 'Reason', v: listing.rejection?.reason },
              s === 'cancelled' && listing.cancellation?.reason && { k: 'Reason', v: listing.cancellation.reason },
            ]}
          />
          {step === 'rejecting' && (
            <div>
              <label htmlFor={`${formId}-reason`} className="block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-tone-red-ink">Reason · required</label>
              <textarea
                id={`${formId}-reason`}
                rows={3}
                maxLength={300}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={touched && !reasonCheck.success ? true : undefined}
                aria-describedby={`${formId}-reason-hint`}
                placeholder="e.g. Moisture too high for storage. Dry for 3 more days and list again."
                className="mt-1.5 w-full resize-y rounded-control border border-danger-line px-3 py-[9px] text-sm focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20"
              />
              <span id={`${formId}-reason-hint`} className={touched && !reasonCheck.success ? 'mt-1 block text-xs text-danger-ink' : 'mt-1 block text-xs text-ink-3'}>
                {touched && !reasonCheck.success ? reasonCheck.error.issues[0].message : 'The farmer sees this in an email and in their dashboard.'}
              </span>
            </div>
          )}
          {step === 'completing' && <CompleteForm formId={formId} listing={listing} onSubmit={doComplete} />}
        </>
      )}
    </Drawer>
  )
}

function CompleteForm({ formId, listing, onSubmit }) {
  const toNumber = (v) => (v === '' || v == null ? undefined : Number(v))
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(beanCompleteFormSchema),
    defaultValues: { finalWeightKg: listing.weightKg, finalAmount: listing.amountCentavos / 100 },
  })
  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 rounded-lg border border-sand-soft bg-cream p-4">
      <strong className="text-sm">Weighed at the branch</strong>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id={`${formId}-fw`} label="Final weight (kg)" type="number" inputMode="decimal" step="0.01" min="0" {...register('finalWeightKg', { setValueAs: toNumber })} error={errors.finalWeightKg?.message} />
        <TextField id={`${formId}-fa`} label="Final amount (₱)" type="number" inputMode="decimal" step="0.01" min="1" {...register('finalAmount', { setValueAs: toNumber })} error={errors.finalAmount?.message} />
      </div>
      <span className="text-xs text-ink-3">{`Listed: ${formatKg(listing.weightKg)} for ${formatPesoShort(listing.amountCentavos)}. Both values are kept.`}</span>
    </form>
  )
}
