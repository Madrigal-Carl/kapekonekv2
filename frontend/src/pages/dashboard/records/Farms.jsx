import { IconPlus } from '@/components/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { MUNICIPALITIES, ownerCell } from '@/constants/records'
import { useCan } from '@/hooks/useCan'
import { useFarmers } from '@/hooks/useFarmers'
import { useArchiveFarm, useFarm, useFarms, useRestoreFarm } from '@/hooks/useRecords'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDay } from '@/lib/date'
import { NotFound } from '@/pages/errors/NotFound'
import { DashPage } from '../overview/Overview'
import { FarmForm } from './FarmForm'
import { FarmView } from './FarmView'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]
const MUNICIPALITY_OPTIONS = [{ value: '', label: 'All towns' }, ...MUNICIPALITIES.map((m) => ({ value: m, label: m }))]
const OWNER_OPTIONS = [
  { value: '', label: 'All owners' },
  { value: 'farmer', label: 'Farmer farms' },
  { value: 'kaluppa', label: 'Kaluppa farms' },
]
// Copy per audience (Farms.dc.html role branches), chosen by permission.
const COPY = {
  kaluppa: ['Farms', 'Every farm on KapeKonek. You can edit Kaluppa’s own farms; farmer farms are view-only.'],
  manager: ['Farms in your association', 'Your farmers’ farms and the Kaluppa farm you manage.'],
  farmer: ['My farms', 'Your farms, their trees and where they are.'],
}

function columns(audience) {
  return [
    { key: 'farm', label: 'Farm', kind: 'strong' },
    audience !== 'farmer' && { key: 'owner', label: 'Owner', kind: 'person' },
    { key: 'loc', label: 'Location' },
    { key: 'size', label: 'Size', align: 'right' },
    { key: 'trees', label: 'Trees', align: 'right' },
    { key: 'last', label: 'Last harvest', kind: 'muted' },
    audience === 'kaluppa' && { key: 'managed', label: 'Managed by' },
  ].filter(Boolean)
}

function toRow(f) {
  const kaluppa = f.ownerType === 'kaluppa'
  return {
    id: f.id,
    label: f.propertyNumber,
    farm: { main: f.propertyNumber, sub: `${f.barangay}, ${f.municipality}` },
    owner: ownerCell(f.owner, f),
    loc: { main: `${f.barangay}, ${f.municipality}`, sub: f.street || '—' },
    size: `${f.sizeHa.toFixed(2)} ha`,
    trees: { main: f.treeCount.toLocaleString('en-PH'), sub: `${f.groupCount} ${f.groupCount === 1 ? 'group' : 'groups'}` },
    last: f.lastHarvest ? `${formatDay(f.lastHarvest.harvestedAt, 'MMM d')} · ${f.lastHarvest.yieldKg} kg` : '—',
    managed: kaluppa ? (f.managedBy ? { main: f.managedBy.name } : { main: 'Not assigned', sub: 'Assign a Group Manager' }) : { main: '—' },
    actions: f.status === 'archived' ? (f.canEdit ? ['view', 'restore'] : ['view']) : f.canEdit ? ['view', 'edit', 'archive'] : ['view'],
    farmRecord: f,
  }
}

/** Farms in the user's scope (Farms.dc.html, PHASE-2-SPEC §3.6): add/edit drawer, view drawer, archive/restore modals. */
export function Farms() {
  const isKaluppa = useCan('records.view_all')
  const actsForFarmers = useCan('farmers.manage') && !isKaluppa
  const audience = isKaluppa ? 'kaluppa' : actsForFarmers ? 'manager' : 'farmer'
  const query = useTableParams({ status: 'active' })
  const { params, set } = query
  const list = useFarms({
    q: params.q || undefined,
    status: params.status || undefined,
    municipality: params.municipality || undefined,
    ownerType: (isKaluppa && params.ownerType) || undefined,
    farmerId: (actsForFarmers && params.farmerId) || undefined,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const farmers = useFarmers({ status: 'approved', limit: 50 }, { enabled: actsForFarmers })
  const openId = params.open && params.open !== 'new' ? params.open : null
  const detail = useFarm(openId)
  const farm = detail.data
  const archive = useArchiveFarm()
  const restore = useRestoreFarm()
  const [modal, setModal] = useState(null) // { kind: 'archive'|'restore', farm }

  const close = () => set({ open: null, mode: null })
  const drawer = params.open === 'new' || (openId && params.mode === 'edit' && farm?.canEdit) ? 'form' : openId ? 'view' : null
  const onAction = (action, row) => {
    if (action === 'archive' || action === 'restore') return setModal({ kind: action, farm: row.farmRecord })
    set({ open: row.id, mode: action === 'edit' ? 'edit' : 'view' })
  }
  const confirm = () => {
    const { kind, farm: target } = modal
    const mutation = kind === 'archive' ? archive : restore
    mutation.mutate(target.id, {
      onSuccess: () => {
        toast.success(kind === 'archive' ? `${target.propertyNumber} was archived.` : `${target.propertyNumber} was restored with its tree groups.`)
        setModal(null)
        if (kind === 'archive') close()
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  // A farm link outside the user's scope (or a deleted one) is a 404, like any unknown page.
  if (detail.error?.response?.status === 404) return <NotFound />

  const filters = [
    { key: 'municipality', label: 'Municipality', options: MUNICIPALITY_OPTIONS },
    actsForFarmers && { key: 'farmerId', label: 'Farmer', options: [{ value: '', label: 'All farmers' }, ...(farmers.data?.items ?? []).map((f) => ({ value: f.id, label: f.name }))] },
    isKaluppa && { key: 'ownerType', label: 'Owner', options: OWNER_OPTIONS },
  ].filter(Boolean)
  const [title, description] = COPY[audience]
  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title={title}
        description={description}
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
            <IconPlus aria-hidden="true" className="size-4" strokeWidth={2.2} />
            Add farm
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Farms"
        columns={columns(audience)}
        rows={list.data?.items.map(toRow)}
        status={{ label: 'Status', options: STATUS_OPTIONS }}
        filters={filters}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={params.status === 'archived' ? { title: 'No archived farms' } : { title: 'No farms yet', text: 'Add a farm to start recording its trees and harvests.' }}
        searchPlaceholder="Search property no. or barangay"
        sortKey="farm"
        minWidth={audience === 'farmer' ? 760 : 980}
        selectedId={params.open}
      />

      <FarmView
        open={drawer === 'view'}
        farm={farm}
        onClose={close}
        onEdit={() => set({ mode: 'edit' })}
        onArchive={() => setModal({ kind: 'archive', farm })}
        onRestore={() => setModal({ kind: 'restore', farm })}
      />
      <FarmForm open={drawer === 'form'} farm={params.open === 'new' ? null : farm} actsForFarmers={actsForFarmers} isKaluppa={isKaluppa} onClose={close} />

      <ConfirmModal
        open={modal?.kind === 'archive'}
        variant="archive"
        title="Archive this farm?"
        confirmLabel="Archive farm"
        cancelLabel="Keep it"
        pending={archive.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        <strong>{modal?.farm.propertyNumber}</strong> ({modal && `${modal.farm.barangay}, ${modal.farm.municipality}`}) and its {modal?.farm.groupCount ?? 0} tree groups move to Archived. Harvest records stay. You can
        restore it any time.
      </ConfirmModal>
      <ConfirmModal
        open={modal?.kind === 'restore'}
        variant="restore"
        title="Restore this farm?"
        confirmLabel="Restore farm"
        cancelLabel="Keep archived"
        pending={restore.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        <strong>{modal?.farm.propertyNumber}</strong> comes back with the tree groups that were archived with it.
      </ConfirmModal>
    </DashPage>
  )
}
