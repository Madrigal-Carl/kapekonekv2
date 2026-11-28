import { format } from 'date-fns'
import { IconPlus } from '@/components/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { avatarFor, FARMER_STATUS as STATUS } from '@/constants/records'
import { useOrgCard } from '@/hooks/useDashboard'
import { useFarmer, useFarmers, useRemoveFarmer } from '@/hooks/useFarmers'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatDate } from '@/lib/date'
import { DashPage } from '../overview/Overview'
import { FarmerReview, FarmerView } from './FarmerDrawers'
import { FarmerForm } from './FarmerForm'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Waiting for approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]
const COLUMNS = [
  { key: 'farmer', label: 'Farmer', kind: 'person' },
  { key: 'contact', label: 'Contact' },
  { key: 'farms', label: 'Farms', align: 'right' },
  { key: 'harvest', label: 'Harvest this year', align: 'right' },
  { key: 'status', label: 'Status', kind: 'pill' },
  { key: 'since', label: 'Since', kind: 'muted' },
]

/** Asking to move into the association this list belongs to (any association, for Kaluppa). */
const incomingTransfer = (farmer, association) => Boolean(farmer?.transferRequest && (!association || farmer.transferRequest.association.id === association.id))
const waiting = (farmer, association) => farmer?.status === 'pending' || incomingTransfer(farmer, association)

function toRow(f, association) {
  const transfer = incomingTransfer(f, association)
  const status = transfer ? 'pending' : f.status
  const since = transfer
    ? `Transfer · ${format(new Date(f.transferRequest.requestedAt), 'MMM d')}`
    : f.status === 'pending'
      ? `Requested ${format(new Date(f.requestedAt ?? f.createdAt), 'MMM d')}`
      : f.status === 'rejected'
        ? 'Rejected'
        : formatDate(f.since)
  return {
    id: f.id,
    label: f.name,
    farmer: { name: f.name, sub: `@${f.username}`, initials: f.initials, avatarClassName: avatarFor(f.id) },
    contact: f.contactNumber,
    // shortcut: farm and harvest totals arrive with M9's farms and harvests.
    farms: null,
    harvest: null,
    status: { label: STATUS[status][0], tone: STATUS[status][1] },
    since,
    actions: status === 'pending' ? ['review'] : status === 'rejected' ? ['view'] : ['view', 'edit', 'archive'],
  }
}

/** Farmers of the Group Manager's association, or every farmer for Kaluppa (Farmers.dc.html, PHASE-2-SPEC §3.2). */
export function Farmers() {
  const query = useTableParams({ status: '' })
  const { params, set } = query
  const list = useFarmers({ q: params.q || undefined, status: params.status || undefined, page: params.page, limit: PAGE_SIZE })
  const org = useOrgCard()
  const association = org.data?.kind === 'group_manager' ? org.data.association : null
  const openId = params.open && params.open !== 'new' ? params.open : null
  const detail = useFarmer(openId)
  const farmer = detail.data
  const remove = useRemoveFarmer()
  const [removing, setRemoving] = useState(null)

  const close = () => set({ open: null, mode: null })
  const drawer = params.open === 'new' || (openId && params.mode === 'edit') ? 'form' : openId && waiting(farmer, association) ? 'review' : openId ? 'view' : null

  const onAction = (action, row) => {
    if (action === 'archive') return setRemoving(row)
    set({ open: row.id, mode: action === 'edit' ? 'edit' : 'view' })
  }
  const onCreated = (created) => {
    close()
    toast.success(`${created.name} is added. We emailed them a link to verify their email.`)
  }
  const confirmRemove = (reason) =>
    remove.mutate(
      { id: removing.id, reason },
      {
        onSuccess: () => {
          toast.success(`${removing.label} was removed from the association.`)
          setRemoving(null)
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    )

  const noAssociation = org.data?.kind === 'group_manager' && !association
  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title="Farmers"
        description={association ? `Everyone in ${association.name}, plus requests waiting for you.` : noAssociation ? 'You’ll see farmers here once Kaluppa assigns you an association.' : 'Every farmer across Marinduque, plus requests waiting for a decision.'}
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} disabled={noAssociation || org.isPending} className="min-h-[42px] py-0 font-semibold">
            <IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />
            Add farmer
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Farmers"
        columns={COLUMNS}
        rows={list.data?.items.map((f) => toRow(f, association))}
        status={{ label: 'Status', options: STATUS_OPTIONS }}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{ title: 'No farmers yet', text: 'Farmers appear here when they ask to join, or when you add them.' }}
        searchPlaceholder="Search name, username or phone"
        minWidth={820}
        selectedId={params.open}
      />

      <FarmerReview open={drawer === 'review'} farmer={farmer} transfer={incomingTransfer(farmer, association)} onClose={close} />
      <FarmerView open={drawer === 'view'} farmer={farmer} canEdit={farmer?.status === 'approved'} onEdit={() => set({ mode: 'edit' })} onClose={close} />
      <FarmerForm open={drawer === 'form'} farmer={params.open === 'new' ? null : farmer} association={association} onClose={close} onCreated={onCreated} />

      <ConfirmModal
        open={Boolean(removing)}
        variant="archive"
        title={`Remove ${removing?.label.split(' ')[0]} from the association?`}
        confirmLabel="Remove farmer"
        cancelLabel="Keep"
        reasonRequired
        reasonPlaceholder="e.g. Moved away from Marinduque"
        pending={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
      >
        They become unaffiliated and unapproved again, so the 5 kg selling limit applies. Their farms and records stay theirs. Your chats with them become read-only.
      </ConfirmModal>
    </DashPage>
  )
}
