import { IconEdit, IconPlus, IconTrash, IconX } from '@/components/ui/icons'
import { History } from '@/components/dashboard/History'
import { lazy, Suspense, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { Drawer } from '@/components/dashboard/Drawer'
import { DetailList, SectionTitle } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { TREE_STAGES, VARIETIES } from '@/constants/charts'
import { avatarFor, initialsOf } from '@/constants/records'
import { useFarmers } from '@/hooks/useFarmers'
import { useArchiveTreeGroup, useHarvests, useSetAssignedFarmers, useTreeGroups } from '@/hooks/useRecords'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatDay } from '@/lib/date'
import { TreeGroupFields } from './TreeForm'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))

const TABS = [
  ['details', 'Details'],
  ['trees', 'Trees'],
  ['harvests', 'Harvests'],
  ['history', 'History'],
]
const variety = (key) => VARIETIES.find((v) => v.key === key)?.label ?? key
const stageOf = (key) => TREE_STAGES.find((s) => s.key === key)
const lastHarvest = (farm) => (farm.lastHarvest ? `${formatDay(farm.lastHarvest.harvestedAt, 'MMM d')} · ${farm.lastHarvest.yieldKg} kg` : 'No harvest yet')
const iconButton = 'size-[34px] hover:bg-crema'

const farmTitle = (farm) => `${farm.propertyNumber} · ${farm.barangay}, ${farm.municipality}`

/**
 * One farm (Farms.dc.html, FarmView board): Details with the map, Trees with inline add/edit, recent Harvests.
 * @param {{ open: boolean, farm?: object, onClose: () => void, onEdit: () => void, onArchive: () => void, onRestore: () => void }} props
 */
export function FarmView({ open, farm, onClose, onEdit, onArchive, onRestore }) {
  const active = farm?.status === 'active'
  const footer = !farm ? null : farm.canEdit && active ? (
    <>
      <Button variant="danger-outline" onClick={onArchive}>Archive</Button>
      <Button onClick={onEdit}>Edit farm</Button>
    </>
  ) : farm.canEdit ? (
    <>
      <Button variant="outline" onClick={onClose}>Close</Button>
      <Button onClick={onRestore}>Restore farm</Button>
    </>
  ) : (
    <Button variant="outline" onClick={onClose}>Close</Button>
  )
  return (
    <Drawer open={open} width={720} eyebrow={farm?.propertyNumber} title={farm ? farmTitle(farm) : 'Farm'} onClose={onClose} footer={footer}>
      {open && (farm ? <FarmSections key={farm.id} farm={farm} /> : <Loading />)}
    </Drawer>
  )
}

function Loading() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-1/2" />
      <Skeleton className="aspect-[600/440] w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  )
}

function FarmSections({ farm }) {
  const [tab, setTab] = useState('details')
  const tabId = useId()
  const label = (key, text) => (key === 'trees' ? `${text} (${farm.groupCount})` : text)
  return (
    <>
      <div role="tablist" aria-label="Farm sections" className="-mt-1.5 flex gap-1 border-b border-sand-soft">
        {TABS.map(([key, text]) => (
          <Button variant="bare"
            key={key}
            role="tab"
            id={`${tabId}-${key}`}
            aria-selected={tab === key}
            aria-controls={`${tabId}-${key}-panel`}
            onClick={() => setTab(key)}
            className={cn(
              '-mb-px min-h-10 cursor-pointer border-0 border-b-2 bg-transparent px-3 text-[13.5px]',
              tab === key ? 'border-roast font-semibold text-ink' : 'border-transparent font-medium text-ink-3 hover:text-ink',
            )}
          >
            {label(key, text)}
          </Button>
        ))}
      </div>
      <div role="tabpanel" id={`${tabId}-${tab}-panel`} aria-labelledby={`${tabId}-${tab}`} className="flex flex-col gap-6">
        {tab === 'details' && <Details farm={farm} />}
        {tab === 'trees' && <Trees farm={farm} />}
        {tab === 'harvests' && <Harvests farm={farm} />}
        {tab === 'history' && <History entityType="farm" entityId={farm.id} divider={false} />}
      </div>
    </>
  )
}

function Details({ farm }) {
  const kaluppa = farm.ownerType === 'kaluppa'
  return (
    <>
      <Suspense fallback={<div className="aspect-[600/440] animate-pulse rounded-card bg-water" />}>
        <MapPicker
          value={farm.location}
          focus={{ municipality: farm.municipality, barangay: farm.barangay }}
          pinLabel={farm.propertyNumber}
          ariaLabel={`Map of ${farm.propertyNumber}`}
        />
      </Suspense>
      <DetailList
        rows={[
          { k: 'Owner', v: kaluppa ? 'Kaluppa' : farm.owner.name },
          { k: 'Association', v: farm.association?.name ?? 'None' },
          { k: 'Size', v: `${farm.sizeHa.toFixed(2)} hectares` },
          { k: 'Location', v: [farm.street, farm.barangay, farm.municipality].filter(Boolean).join(', ') },
          { k: 'Varieties', v: farm.varieties.length ? farm.varieties.map(variety).join(', ') : 'No trees yet' },
          { k: 'Last harvest', v: lastHarvest(farm) },
          kaluppa && { k: 'Managed by', v: farm.managedBy?.name ?? 'Not assigned' },
        ]}
      />
      {kaluppa && <Workers farm={farm} />}
    </>
  )
}

/** Farmers working on a Kaluppa farm; only its Group Manager changes the list (PHASE-2-SPEC §3.6). */
function Workers({ farm }) {
  const assign = useSetAssignedFarmers()
  const farmers = useFarmers({ status: 'approved', limit: 50 }, { enabled: farm.canAssignFarmers })
  const ids = farm.assignedFarmers.map((f) => f.id)
  const save = (next, message) =>
    assign.mutate({ id: farm.id, farmerIds: next }, { onSuccess: () => toast.success(message), onError: (error) => toast.error(errorMessage(error)) })
  const options = (farmers.data?.items ?? []).filter((f) => !ids.includes(f.id)).map((f) => ({ value: f.id, label: f.name }))
  return (
    <>
      <SectionTitle>Farmers working on it</SectionTitle>
      {farm.assignedFarmers.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {farm.assignedFarmers.map((f) => (
            <li key={f.id} className="inline-flex items-center gap-1.5 rounded-full bg-crema py-1 pl-1 pr-1.5 text-[12.5px] font-medium">
              <span aria-hidden="true" className={cn('grid size-6 place-items-center rounded-full text-[10px] font-semibold text-white', avatarFor(f.id))}>{initialsOf(f.name)}</span>
              {f.name}
              {farm.canAssignFarmers && (
                <Button variant="bare"
                  aria-label={`Remove ${f.name}`}
                  disabled={assign.isPending}
                  onClick={() => save(ids.filter((id) => id !== f.id), `${f.name} no longer works on this farm.`)}
                  className="grid size-6 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-ink-3 hover:bg-white"
                >
                  <IconX aria-hidden="true" className="size-3.5" strokeWidth={2} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-3">No farmers are assigned yet.</p>
      )}
      {farm.canAssignFarmers && (
        <div className="max-w-[340px]">
          <SearchSelect
            aria-label="Assign a farmer"
            icon="home"
            size="sm"
            placeholder="Assign a farmer from your association"
            searchPlaceholder="Search farmer"
            options={options}
            value={null}
            disabled={assign.isPending}
            onChange={(id) => save([...ids, id], `${options.find((o) => o.value === id)?.label} now works on this farm.`)}
          />
        </div>
      )}
      <p className="text-xs text-ink-3">Only the Group Manager it’s assigned to can change this list.</p>
    </>
  )
}

function Trees({ farm }) {
  const formId = useId()
  const groups = useTreeGroups({ farmId: farm.id, limit: 50 })
  const archive = useArchiveTreeGroup()
  const [editing, setEditing] = useState(null) // 'new' | group
  const [removing, setRemoving] = useState(null)
  const canAdd = farm.canManageRecords && farm.status === 'active'
  const confirmRemove = () =>
    archive.mutate(removing.id, {
      onSuccess: () => {
        toast.success('Tree group removed. Find it under Archived.')
        setRemoving(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-2">{`${farm.treeCount.toLocaleString('en-PH')} trees in ${farm.groupCount} ${farm.groupCount === 1 ? 'group' : 'groups'}`}</span>
        {canAdd && !editing && (
          <Button variant="outline" onClick={() => setEditing('new')} className="min-h-[38px] py-0 text-[13px] font-semibold">
            <IconPlus aria-hidden="true" className="size-4" strokeWidth={2.2} />
            Add tree group
          </Button>
        )}
      </div>
      {editing && <TreeGroupFields key={editing.id ?? 'new'} inline formId={formId} farm={farm} group={editing === 'new' ? null : editing} onSaved={() => setEditing(null)} />}
      {groups.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : groups.isError ? (
        <p className="text-[13px] text-danger-text">We couldn’t load the trees. {errorMessage(groups.error)}</p>
      ) : groups.data.items.length === 0 ? (
        <p className="rounded-control border border-dashed border-sand bg-cream px-4 py-8 text-center text-[13px] text-ink-3">No tree groups on this farm yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {groups.data.items.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-lg border border-sand p-3">
              <span aria-hidden="true" className="h-[38px] w-2.5 rounded" style={{ background: stageOf(g.stage).color }} />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{`${g.count} ${variety(g.variety)} trees`}</span>
                <span className="block text-xs text-ink-3">{`${stageOf(g.stage).label} · planted ${formatDay(g.plantedAt, 'MMM yyyy')}${g.note ? ` · ${g.note}` : ''}`}</span>
              </div>
              {g.canEdit && canAdd && (
                <>
                  <Button variant="ghost" size="sm" iconOnly aria-label="Edit tree group" onClick={() => setEditing(g)} className={cn(iconButton, 'text-ink-2 hover:text-ink-2')}>
                    <IconEdit aria-hidden="true" className="size-4" strokeWidth={1.9} />
                  </Button>
                  <Button variant="ghost" size="sm" iconOnly aria-label="Remove tree group" onClick={() => setRemoving(g)} className={cn(iconButton, 'text-logout hover:text-logout')}>
                    <IconTrash aria-hidden="true" className="size-4" strokeWidth={1.9} />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmModal
        open={Boolean(removing)}
        variant="archive"
        title="Remove this tree group?"
        confirmLabel="Remove"
        cancelLabel="Keep"
        pending={archive.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      >
        <strong>{removing && `${removing.count} ${variety(removing.variety)} trees`}</strong> on {farm.propertyNumber} move to Archived. You can restore them.
      </ConfirmModal>
    </>
  )
}

function Harvests({ farm }) {
  const harvests = useHarvests({ farmId: farm.id, period: 'all', limit: 4 })
  return (
    <>
      {harvests.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : harvests.isError ? (
        <p className="text-[13px] text-danger-text">We couldn’t load the harvests. {errorMessage(harvests.error)}</p>
      ) : harvests.data.items.length === 0 ? (
        <p className="rounded-control border border-dashed border-sand bg-cream px-4 py-8 text-center text-[13px] text-ink-3">No harvests recorded on this farm yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {harvests.data.items.map((h) => (
            <li key={h.id} className="flex justify-between gap-3 rounded-lg border border-sand p-3 text-[13.5px]">
              <span>
                <strong>{`${h.yieldKg.toLocaleString('en-PH')} kg ${variety(h.variety)}`}</strong>
                <span className="block text-xs text-ink-3">Recorded by {h.recordedBy?.name ?? 'someone'}</span>
              </span>
              <span className="text-ink-2">{formatDay(h.harvestedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/dashboard/harvests?farmId=${farm.id}`} className="text-[13px] font-semibold no-underline">
        Add or edit harvests
      </Link>
    </>
  )
}
