import { IconPlus } from '@/components/ui/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { VARIETIES } from '@/constants/charts'
import { farmFilter, ownerCell, RECORD_STATUS, recordActions, VARIETY_FILTER } from '@/constants/records'
import { useCan } from '@/hooks/useCan'
import { useArchiveHarvest, useFarms, useHarvests, useRestoreHarvest } from '@/hooks/useRecords'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDay } from '@/lib/date'
import { DashPage } from '../overview/Overview'
import { HarvestForm } from './HarvestForm'

const PAGE_SIZE = 10
const PERIOD_FILTER = {
  key: 'period',
  label: 'Period',
  options: [
    { value: 'last_12_months', label: 'Last 12 months' },
    { value: 'this_year', label: 'This year' },
    { value: 'last_year', label: 'Last year' },
    { value: 'all', label: 'All time' },
  ],
}
const varietyLabel = (key) => VARIETIES.find((v) => v.key === key)?.label ?? key
const kg = (value) => `${value.toLocaleString('en-PH')} kg`

function toRow(h, showOwner) {
  return {
    id: h.id,
    label: `${kg(h.yieldKg)} ${varietyLabel(h.variety)}`,
    date: formatDay(h.harvestedAt),
    farm: { main: h.farm.propertyNumber, sub: `${h.farm.barangay}, ${h.farm.municipality}` },
    owner: showOwner ? ownerCell(h.owner, h.farm) : null,
    variety: varietyLabel(h.variety),
    kg: kg(h.yieldKg),
    by: h.recordedBy?.name ?? '—',
    note: h.note || '—',
    actions: recordActions(h),
    record: h,
  }
}

/** The three tiles: this year's yield, the top variety, the last harvest (Harvests.dc.html). */
function SummaryTiles({ summary }) {
  const tiles = [
    { k: 'This year', v: summary ? kg(summary.thisYear.yieldKg) : '—', n: summary ? `${summary.thisYear.harvests} ${summary.thisYear.harvests === 1 ? 'harvest' : 'harvests'}` : '' },
    { k: 'Top variety', v: summary?.topVariety ? varietyLabel(summary.topVariety.variety) : '—', n: summary?.topVariety ? `${summary.topVariety.share}% of the yield` : 'No harvests this year' },
    {
      k: 'Last harvest',
      v: summary?.lastHarvest ? kg(summary.lastHarvest.yieldKg) : '—',
      n: summary?.lastHarvest ? `${formatDay(summary.lastHarvest.harvestedAt, 'MMM d')} · ${summary.lastHarvest.farm.propertyNumber}` : 'Nothing recorded yet',
    },
  ]
  return (
    <ul aria-label="Harvest summary" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5 p-0">
      {tiles.map((t) => (
        <li key={t.k} className="rounded-lg border border-sand bg-white px-4 py-3.5">
          <span className="block text-[12.5px] text-ink-2">{t.k}</span>
          <span className="block text-[22px] font-semibold">{t.v}</span>
          <span className="block text-xs text-ink-3">{t.n}</span>
        </li>
      ))}
    </ul>
  )
}

/** Harvests in the user's scope (Harvests.dc.html, PHASE-2-SPEC §3.6). */
export function Harvests() {
  const navigate = useNavigate()
  const isKaluppa = useCan('records.view_all')
  const actsForFarmers = useCan('farmers.manage') && !isKaluppa
  const showOwner = isKaluppa || actsForFarmers
  const query = useTableParams({ status: 'active', period: 'last_12_months' })
  const { params, set } = query
  const list = useHarvests({
    q: params.q || undefined,
    status: params.status || undefined,
    farmId: params.farmId || undefined,
    variety: params.variety || undefined,
    period: params.period,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const farms = useFarms({ status: 'active', limit: 50 })
  const archive = useArchiveHarvest()
  const restore = useRestoreHarvest()
  const [modal, setModal] = useState(null) // { kind, harvest }
  const editing = params.open && params.open !== 'new' ? list.data?.items.find((h) => h.id === params.open) : null
  const close = () => set({ open: null, mode: null })

  const onAction = (action, row) => {
    if (action === 'view') return navigate(`/dashboard/farms?open=${row.record.farm.id}`)
    if (action === 'edit') return set({ open: row.id, mode: 'edit' })
    setModal({ kind: action, harvest: row.record })
  }
  const confirm = () => {
    const { kind, harvest } = modal
    ;(kind === 'archive' ? archive : restore).mutate(harvest.id, {
      onSuccess: () => {
        toast.success(kind === 'archive' ? 'Harvest archived.' : 'Harvest restored.')
        setModal(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const columns = [
    { key: 'date', label: 'Harvested on', kind: 'strong' },
    { key: 'farm', label: 'Farm' },
    showOwner && { key: 'owner', label: 'Owner', kind: 'person' },
    { key: 'variety', label: 'Variety' },
    { key: 'kg', label: 'Yield', align: 'right' },
    { key: 'by', label: 'Recorded by', kind: 'muted' },
    { key: 'note', label: 'Notes', kind: 'muted', wrap: true },
  ].filter(Boolean)
  const harvest = modal?.harvest
  const what = harvest && (
    <>
      <strong>{`${kg(harvest.yieldKg)} ${varietyLabel(harvest.variety)}`}</strong> from {harvest.farm.propertyNumber} on {formatDay(harvest.harvestedAt)}
    </>
  )
  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title="Harvests"
        description={isKaluppa ? 'All harvests. Record harvests for Kaluppa’s own farms here.' : 'Each harvest you record counts toward the reports.'}
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
            <IconPlus aria-hidden="true" className="size-4" strokeWidth={2.2} />
            Add harvest
          </Button>
        }
      />
      <SummaryTiles summary={list.data?.meta.summary} />
      <DataTable
        query={query}
        ariaLabel="Harvests"
        columns={columns}
        rows={list.data?.items.map((h) => toRow(h, showOwner))}
        status={RECORD_STATUS}
        filters={[farmFilter(farms.data?.items), VARIETY_FILTER, PERIOD_FILTER]}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={params.status === 'archived' ? { title: 'No archived harvests' } : { title: 'No harvests in this period', text: 'Record a harvest after each picking. It counts toward the reports.' }}
        searchPlaceholder="Search farm, variety or note"
        minWidth={showOwner ? 1000 : 820}
        selectedId={params.open}
      />

      <HarvestForm open={params.open === 'new' || Boolean(editing)} harvest={editing} actsForFarmers={actsForFarmers} onClose={close} />
      <ConfirmModal
        open={modal?.kind === 'archive'}
        variant="archive"
        title="Archive this harvest?"
        confirmLabel="Archive"
        cancelLabel="Keep"
        pending={archive.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        {what} leaves your totals. You can restore it.
      </ConfirmModal>
      <ConfirmModal
        open={modal?.kind === 'restore'}
        variant="restore"
        title="Restore this harvest?"
        confirmLabel="Restore"
        cancelLabel="Keep archived"
        pending={restore.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        {what} counts toward your totals again.
      </ConfirmModal>
    </DashPage>
  )
}
