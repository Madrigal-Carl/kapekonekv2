import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { TREE_STAGES, VARIETIES } from '@/constants/charts'
import { farmFilter, ownerCell, RECORD_STATUS, recordActions, STAGE_TONE, VARIETY_FILTER } from '@/constants/records'
import { useCan } from '@/hooks/useCan'
import { useArchiveTreeGroup, useFarms, useRestoreTreeGroup, useTreeGroups } from '@/hooks/useRecords'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDay } from '@/lib/date'
import { DashPage } from '../overview/Overview'
import { TreeForm } from './TreeForm'

const PAGE_SIZE = 10
const STAGE_FILTER = { key: 'stage', label: 'Stage', options: [{ value: '', label: 'All stages' }, ...TREE_STAGES.map((s) => ({ value: s.key, label: s.label }))] }
const DESCRIPTION = {
  kaluppa: 'Every tree group. You can edit the ones on Kaluppa farms.',
  manager: 'Tree groups on your farmers’ farms and the Kaluppa farm you manage.',
  farmer: 'Groups of trees on your farms, by variety and stage.',
}
const varietyLabel = (key) => VARIETIES.find((v) => v.key === key)?.label ?? key

function toRow(g, audience) {
  const stage = TREE_STAGES.find((s) => s.key === g.stage)
  return {
    id: g.id,
    label: `${g.count} ${varietyLabel(g.variety)}`,
    farm: { main: g.farm.propertyNumber, sub: g.farm.lotNumber },
    owner: audience === 'farmer' ? null : ownerCell(g.owner, g.farm),
    variety: varietyLabel(g.variety),
    stage: { label: stage.label, tone: STAGE_TONE[g.stage] },
    count: g.count.toLocaleString('en-PH'),
    planted: formatDay(g.plantedAt, 'MMM yyyy'),
    note: g.note || '—',
    actions: recordActions(g),
    record: g,
  }
}

/** Tree groups in the user's scope with trees-per-stage tiles (Trees.dc.html, PHASE-2-SPEC §3.6). */
export function Trees() {
  const navigate = useNavigate()
  const isKaluppa = useCan('records.view_all')
  const actsForFarmers = useCan('farmers.manage') && !isKaluppa
  const audience = isKaluppa ? 'kaluppa' : actsForFarmers ? 'manager' : 'farmer'
  const query = useTableParams({ status: 'active' })
  const { params, set } = query
  const list = useTreeGroups({
    q: params.q || undefined,
    status: params.status || undefined,
    farmId: params.farmId || undefined,
    variety: params.variety || undefined,
    stage: params.stage || undefined,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const farms = useFarms({ status: 'active', limit: 50 })
  const archive = useArchiveTreeGroup()
  const restore = useRestoreTreeGroup()
  const [modal, setModal] = useState(null) // { kind, group }
  const editing = params.open && params.open !== 'new' ? list.data?.items.find((g) => g.id === params.open) : null
  const close = () => set({ open: null, mode: null })

  const onAction = (action, row) => {
    if (action === 'view') return navigate(`/dashboard/farms?open=${row.record.farm.id}`)
    if (action === 'edit') return set({ open: row.id, mode: 'edit' })
    setModal({ kind: action, group: row.record })
  }
  const confirm = () => {
    const { kind, group } = modal
    ;(kind === 'archive' ? archive : restore).mutate(group.id, {
      onSuccess: () => {
        toast.success(kind === 'archive' ? 'Tree group removed. Find it under Archived.' : 'Tree group restored.')
        setModal(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  const totals = list.data?.meta.stageTotals
  const columns = [
    { key: 'farm', label: 'Farm', kind: 'strong' },
    audience !== 'farmer' && { key: 'owner', label: 'Owner', kind: 'person' },
    { key: 'variety', label: 'Variety' },
    { key: 'stage', label: 'Stage', kind: 'pill' },
    { key: 'count', label: 'Trees', align: 'right' },
    { key: 'planted', label: 'Planted', kind: 'muted' },
    { key: 'note', label: 'Note', kind: 'muted', wrap: true },
  ].filter(Boolean)
  const group = modal?.group
  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title="Trees"
        description={DESCRIPTION[audience]}
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.2} />
            Add tree group
          </Button>
        }
      />
      <ul aria-label="Trees by stage" className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5 p-0">
        {TREE_STAGES.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 rounded-lg border border-sand bg-white px-3.5 py-3">
            <span aria-hidden="true" className="h-[30px] w-2 rounded" style={{ background: s.color }} />
            <span>
              <span className="block text-xs text-ink-2">{s.label}</span>
              <span className="block text-lg font-semibold">{totals ? (totals[s.key] ?? 0).toLocaleString('en-PH') : '—'}</span>
            </span>
          </li>
        ))}
      </ul>
      <DataTable
        query={query}
        ariaLabel="Tree groups"
        columns={columns}
        rows={list.data?.items.map((g) => toRow(g, audience))}
        status={RECORD_STATUS}
        filters={[farmFilter(farms.data?.items), VARIETY_FILTER, STAGE_FILTER]}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={params.status === 'archived' ? { title: 'No archived tree groups' } : { title: 'No tree groups yet', text: 'Add the trees growing on your farms, by variety and stage.' }}
        searchPlaceholder="Search farm, variety or note"
        minWidth={audience === 'farmer' ? 820 : 1000}
        selectedId={params.open}
      />

      <TreeForm open={params.open === 'new' || Boolean(editing)} group={editing} actsForFarmers={actsForFarmers} onClose={close} />
      <ConfirmModal
        open={modal?.kind === 'archive'}
        variant="archive"
        title="Remove this tree group?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        pending={archive.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        <strong>{group && `${group.count} ${varietyLabel(group.variety)} trees`}</strong> on {group?.farm.propertyNumber} move to Archived. You can restore them.
      </ConfirmModal>
      <ConfirmModal
        open={modal?.kind === 'restore'}
        variant="restore"
        title="Restore this tree group?"
        confirmLabel="Restore"
        cancelLabel="Keep archived"
        pending={restore.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        <strong>{group && `${group.count} ${varietyLabel(group.variety)} trees`}</strong> on {group?.farm.propertyNumber} count toward your totals again.
      </ConfirmModal>
    </DashPage>
  )
}
