import { IconPlus } from '@/components/ui/icons'
import { format } from 'date-fns'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { BEAN_STATUS, FORM_FILTER, formLabel, KALUPPA_STATUS_FILTER, SELLER_STATUS_FILTER, varietyLabel } from '@/constants/beans'
import { avatarFor, initialsOf, VARIETY_FILTER } from '@/constants/records'
import { useAuth } from '@/hooks/useAuth'
import { useBean, useBeanCap, useBeans, useCancelBean } from '@/hooks/useBeans'
import { useCan } from '@/hooks/useCan'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatKg, formatPesoShort } from '@/lib/format'
import { NotFound } from '@/pages/errors/NotFound'
import { DashPage } from '../overview/Overview'
import { BeanForm } from './BeanForm'
import { BeanReview, BeanView } from './BeanView'

const PAGE_SIZE = 10
const STEPS = [
  { t: 'List your beans', d: 'Variety, form, weight, your price, photos' },
  { t: 'Kaluppa reviews', d: 'Approves or rejects with a reason' },
  { t: 'Bring them within 7 days', d: 'To the Kaluppa branch in Pantayin' },
  { t: 'Completed', d: 'Weighed and paid at the branch' },
]

function actionsFor(l, isKaluppa) {
  if (isKaluppa) return [l.status === 'pending' ? 'review' : 'view']
  if (l.status === 'pending') return l.canEdit ? ['view', 'edit', 'cancel'] : ['view']
  return l.status === 'approved' ? ['view', 'cancel'] : ['view']
}

function toRow(l, isKaluppa) {
  return {
    id: l.id,
    label: l.listingNumber,
    code: { main: l.listingNumber, sub: `Listed ${format(new Date(l.createdAt), 'MMM d')}` },
    farmer: {
      name: l.farmer.name,
      sub: l.countsTowardCap ? 'Unapproved · 5 kg limit' : (l.association?.name ?? ''),
      initials: initialsOf(l.farmer.name),
      avatarClassName: avatarFor(l.farmer.id),
    },
    beans: { main: varietyLabel(l.variety), sub: formLabel(l.form) },
    kg: formatKg(l.weightKg),
    price: `${formatPesoShort(l.pricePerKgCentavos)}/kg`,
    amount: formatPesoShort(l.amountCentavos),
    status: BEAN_STATUS[l.status],
    actions: actionsFor(l, isKaluppa),
    record: l,
  }
}

/** “You can sell up to 5 kg until you’re approved.” with the meter (BeansFarmer.dc.html). */
function SellingLimit({ cap }) {
  const pct = Math.min(100, (cap.usedKg / cap.capKg) * 100)
  return (
    <section aria-label="Selling limit" className="flex flex-wrap items-center gap-4 rounded-lg border border-notice-line bg-notice-bg px-4 py-3.5 text-notice-ink">
      <div className="flex-[1_1_280px] text-[13.5px] leading-[1.55]">
        <strong>You can sell up to {formatKg(cap.capKg)} until you’re approved.</strong> Pending, approved and completed listings count.{' '}
        <Link to="/dashboard/account/association" className="font-semibold text-notice-ink underline">Check your request</Link>
      </div>
      <div className="flex-[1_1_260px]">
        <div className="flex justify-between text-[12.5px]">
          <span><strong>{formatKg(cap.usedKg)}</strong> of {formatKg(cap.capKg)} used</span>
          <span>{formatKg(cap.leftKg)} left</span>
        </div>
        <div role="progressbar" aria-label="Selling limit used" aria-valuemin={0} aria-valuemax={cap.capKg} aria-valuenow={cap.usedKg} className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-notice-track">
          <span className="block h-full rounded-full bg-roast" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </section>
  )
}

function Steps() {
  return (
    <ol aria-label="How selling works" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 p-0">
      {STEPS.map((s, i) => (
        <li key={s.t} className="flex items-start gap-2.5 rounded-lg border border-sand bg-white px-3.5 py-3">
          <span aria-hidden="true" className="grid size-[26px] shrink-0 place-items-center rounded-full bg-crema text-xs font-bold text-roast">{i + 1}</span>
          <span className="text-[13px] leading-normal">
            <strong>{s.t}</strong>
            <span className="block text-ink-3">{s.d}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Kaluppa's four tiles (BeansKaluppa.dc.html), from the list's `meta.tiles`. */
function KaluppaTiles({ tiles }) {
  const items = [
    { k: 'To review', v: tiles ? String(tiles.toReview.count) : '—', n: tiles ? `${formatKg(tiles.toReview.kg)} offered` : '' },
    {
      k: 'Waiting for drop-off',
      v: tiles ? String(tiles.waiting.count) : '—',
      n: tiles ? [formatKg(tiles.waiting.kg), tiles.waiting.nextExpiresAt && `expires ${format(new Date(tiles.waiting.nextExpiresAt), 'MMM d')}`].filter(Boolean).join(' · ') : '',
    },
    { k: 'Bought this month', v: tiles ? formatKg(tiles.boughtThisMonth.kg) : '—', n: tiles ? `${formatPesoShort(tiles.boughtThisMonth.paidCentavos)} paid` : '' },
    { k: 'Average price', v: tiles?.averagePriceCentavos ? `${formatPesoShort(Math.round(tiles.averagePriceCentavos / 100) * 100)}/kg` : '—', n: 'completed, last 30 days' },
  ]
  return (
    <ul aria-label="Bean summary" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 p-0">
      {items.map((t) => (
        <li key={t.k} className="rounded-lg border border-sand bg-white px-4 py-3.5">
          <span className="block text-[12.5px] text-ink-2">{t.k}</span>
          <span className="block text-[22px] font-semibold">{t.v}</span>
          <span className="block text-xs text-ink-3">{t.n}</span>
        </li>
      ))}
    </ul>
  )
}

/** Bean sales to Kaluppa (PHASE-2-SPEC §3.5): the farmer's and Group Manager's listings, or Kaluppa's review queue. */
export function Beans() {
  const { user } = useAuth()
  const isKaluppa = useCan('records.view_all')
  const actsForFarmers = useCan('farmers.manage') && !isKaluppa
  const query = useTableParams(isKaluppa ? { status: 'pending' } : {})
  const { params, set } = query
  const list = useBeans({
    q: params.q || undefined,
    status: params.status || undefined,
    variety: params.variety || undefined,
    form: params.form || undefined,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const cap = useBeanCap(undefined, { enabled: !isKaluppa && !actsForFarmers })
  const openId = params.open && params.open !== 'new' ? params.open : null
  const opened = useBean(openId)
  const cancel = useCancelBean()
  const [cancelling, setCancelling] = useState(null) // the listing in the cancel modal
  const close = () => set({ open: null, mode: null })

  const onAction = (action, row) => {
    if (action === 'edit') return set({ open: row.id, mode: 'edit' })
    if (action === 'cancel') return setCancelling(row.record)
    set({ open: row.id, mode: null })
  }
  const confirmCancel = (reason) =>
    cancel.mutate(
      { id: cancelling.id, reason },
      {
        onSuccess: () => {
          toast.success(isKaluppa ? 'Sale cancelled.' : `${cancelling.listingNumber} was cancelled.`)
          setCancelling(null)
          close()
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )

  const columns = [
    { key: 'code', label: 'Listing', kind: 'strong' },
    (isKaluppa || actsForFarmers) && { key: 'farmer', label: 'Farmer', kind: 'person' },
    { key: 'beans', label: 'Beans' },
    { key: 'kg', label: 'Weight', align: 'right' },
    { key: 'price', label: isKaluppa ? 'Asking' : 'Price', align: 'right' },
    { key: 'amount', label: 'Amount', align: 'right' },
    { key: 'status', label: 'Status', kind: 'pill' },
  ].filter(Boolean)
  const filtered = Boolean(params.q || params.variety || params.form || (params.status && params.status !== (isKaluppa ? 'pending' : undefined)))
  const editing = params.mode === 'edit' ? opened.data : null
  // A listing link outside the user's scope (a notification for someone else, an old link) is a 404 like any unknown page.
  if (opened.error?.response?.status === 404) return <NotFound />

  return (
    <DashPage>
      <PageHeader
        eyebrow="Marketplace"
        title={isKaluppa ? 'Beans from farmers' : actsForFarmers ? 'Beans from your farmers' : 'Sell beans to Kaluppa'}
        description={
          isKaluppa
            ? 'Review listings, then complete them when the beans arrive at the branch. Approved listings expire after 7 days.'
            : actsForFarmers
              ? 'List beans for a farmer who needs help, and follow every listing in your association.'
              : 'List what you want to sell. Kaluppa reviews it, you bring the beans to the branch, and Kaluppa completes the sale.'
        }
        actions={
          !isKaluppa && (
            <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
              <IconPlus aria-hidden="true" className="size-4" strokeWidth={2.2} />
              Sell beans
            </Button>
          )
        }
      />
      {isKaluppa ? <KaluppaTiles tiles={list.data?.meta.tiles} /> : (
        <>
          {cap.data && !cap.data.approved && <SellingLimit cap={cap.data} />}
          <Steps />
        </>
      )}
      <DataTable
        query={query}
        ariaLabel="Bean listings"
        columns={columns}
        rows={list.data?.items.map((l) => toRow(l, isKaluppa))}
        status={isKaluppa ? KALUPPA_STATUS_FILTER : SELLER_STATUS_FILTER}
        filters={[VARIETY_FILTER, FORM_FILTER]}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          filtered
            ? { title: 'No listings match', text: 'Try another status, variety or form.' }
            : isKaluppa
              ? { title: 'Nothing to review', text: 'New listings from farmers appear here.' }
              : { title: 'No listings yet', text: 'Sell beans to list what you want to sell to Kaluppa.' }
        }
        searchPlaceholder={isKaluppa || actsForFarmers ? 'Search listing no., farmer or variety' : 'Search listing no. or variety'}
        minWidth={isKaluppa ? 1060 : actsForFarmers ? 1000 : 840}
        selectedId={params.open}
      />

      <BeanForm open={params.open === 'new' || Boolean(editing)} listing={editing} actsForFarmers={actsForFarmers} onClose={close} />
      {isKaluppa ? (
        <BeanReview open={Boolean(openId) && params.mode !== 'edit'} listing={opened.data} onCancelSale={() => setCancelling(opened.data)} onClose={close} />
      ) : (
        <BeanView open={Boolean(openId) && params.mode !== 'edit'} listing={opened.data} meId={user?.id} onCancel={() => setCancelling(opened.data)} onClose={close} />
      )}
      <ConfirmModal
        open={Boolean(cancelling)}
        variant="cancel_sale"
        title={isKaluppa ? 'Cancel this sale?' : 'Cancel this listing?'}
        confirmLabel={isKaluppa ? 'Cancel sale' : 'Cancel listing'}
        cancelLabel={isKaluppa ? 'Keep sale' : 'Keep'}
        reasonRequired={isKaluppa}
        reasonPlaceholder="e.g. Not brought within the agreed date"
        pending={cancel.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      >
        {cancelling &&
          (isKaluppa ? (
            `${cancelling.listingNumber} was approved but the beans haven’t arrived. ${cancelling.farmer.name.split(' ')[0]} gets an email.`
          ) : (
            <>
              <strong>{cancelling.listingNumber}</strong> ({formatKg(cancelling.weightKg)} {varietyLabel(cancelling.variety)}) is withdrawn. Kaluppa is told. Cancelled kilograms don’t count toward your limit.
            </>
          ))}
      </ConfirmModal>
    </DashPage>
  )
}
