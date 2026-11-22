import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { Drawer } from '@/components/dashboard/Drawer'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { DetailList, SectionTitle, StatTiles, TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { FieldHint, Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { avatarFor, FARMER_STATUS as STATUS } from '@/constants/records'
import {
  useArchiveAssociation,
  useAssociation,
  useAssociations,
  useCreateAssociation,
  useGroupManagers,
  useRestoreAssociation,
  useUpdateAssociation,
} from '@/hooks/useAssociations'
import { useFarmers } from '@/hooks/useFarmers'
import { useLocations } from '@/hooks/useSettings'
import { useTableParams } from '@/hooks/useTableParams'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/date'
import { associationFormSchema } from '@/schemas/records.schema'
import { FormFooter } from '../farmers/FarmerForm'
import { DashPage } from '../overview/Overview'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]
const COLUMNS = [
  { key: 'association', label: 'Association', kind: 'strong' },
  { key: 'gm', label: 'Group Manager' },
  { key: 'farmers', label: 'Farmers' },
  { key: 'farms', label: 'Farms', align: 'right' },
  { key: 'harvest', label: 'Harvest this year', align: 'right' },
  { key: 'status', label: 'Status', kind: 'pill' },
]
const FIELDS = ['name', 'municipality', 'description', 'groupManagerId']
const MEMBER_TONE = { green: 'text-tone-green-ink', amber: 'text-tone-amber-ink', red: 'text-tone-red-ink' }

const pill = (a) => (a.status === 'archived' ? { label: 'Archived', tone: 'gray' } : a.groupManager ? { label: 'Active', tone: 'green' } : { label: 'Needs a Group Manager', tone: 'amber' })
const toRow = (a) => ({
  id: a.id,
  label: a.name,
  association: { main: a.name, sub: a.municipality },
  gm: a.groupManager ? { main: a.groupManager.name } : { main: 'No Group Manager', sub: 'Kaluppa reviews requests' },
  farmers: `${a.farmerCount}${a.waitingCount ? ` · ${a.waitingCount} waiting` : ''}`,
  // shortcut: farm and harvest totals arrive with M9's farms and harvests.
  farms: null,
  harvest: null,
  status: pill(a),
  actions: a.status === 'archived' ? ['view', 'restore'] : ['view', 'edit', 'archive'],
  record: a,
})
/** What still blocks archiving (the server checks the same). */
const blockers = (a) => {
  const farmers = a.farmerCount + a.waitingCount
  return [farmers && `${farmers} farmer${farmers === 1 ? '' : 's'}`, a.groupManager && 'a Group Manager'].filter(Boolean)
}

/** Farmer groups across Marinduque (Associations.dc.html, PHASE-2-SPEC §3.3). */
export function Associations() {
  const query = useTableParams({ status: 'active', municipality: '' })
  const { params, set } = query
  const list = useAssociations({ q: params.q || undefined, status: params.status || undefined, municipality: params.municipality || undefined, page: params.page, limit: PAGE_SIZE })
  const locations = useLocations()
  const openId = params.open && params.open !== 'new' ? params.open : null
  const detail = useAssociation(openId)
  const archive = useArchiveAssociation()
  const restore = useRestoreAssociation()
  const [confirming, setConfirming] = useState(null) // { action, association }

  const close = () => set({ open: null, mode: null })
  const drawer = params.open === 'new' || (openId && params.mode === 'edit') ? 'form' : openId ? 'view' : null
  const onAction = (action, row) => {
    if (action === 'archive' || action === 'restore') return setConfirming({ action, association: row.record })
    set({ open: row.id, mode: action === 'edit' ? 'edit' : 'view' })
  }
  const target = confirming?.association
  const blocked = confirming?.action === 'archive' ? blockers(target) : []
  const confirm = () =>
    (confirming.action === 'archive' ? archive : restore).mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.name} was ${confirming.action === 'archive' ? 'archived' : 'restored'}.`)
        setConfirming(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title="Associations"
        description="Farmer groups across Marinduque. Each has one Group Manager and a group chat."
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2} />
            Add association
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Associations"
        columns={COLUMNS}
        rows={list.data?.items.map(toRow)}
        status={{ label: 'Status', options: STATUS_OPTIONS }}
        filters={[{ key: 'municipality', label: 'Municipality', options: [{ value: '', label: 'All towns' }, ...(locations.data ?? []).map((m) => ({ value: m.name, label: m.name }))] }]}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={params.status === 'archived' ? { title: 'No archived associations' } : { title: 'No associations yet', text: 'Add one for each farmer group. Its group chat is created with it.' }}
        searchPlaceholder="Search association or town"
        minWidth={820}
        selectedId={params.open}
      />

      <AssociationView open={drawer === 'view'} association={detail.data} onEdit={() => set({ mode: 'edit' })} onClose={close} />
      <AssociationForm open={drawer === 'form'} association={params.open === 'new' ? null : detail.data} onClose={close} />

      <ConfirmModal
        open={Boolean(confirming)}
        variant={confirming?.action ?? 'archive'}
        title={`${confirming?.action === 'restore' ? 'Restore' : 'Archive'} ${target?.name}?`}
        confirmLabel={confirming?.action === 'restore' ? 'Restore' : 'Archive'}
        cancelLabel="Close"
        pending={archive.isPending || restore.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={blocked.length ? undefined : confirm}
      >
        {confirming?.action === 'restore' ? (
          'Farmers can ask to join it again. Assign a Group Manager from Edit.'
        ) : blocked.length ? (
          <>
            You can’t archive it yet: it still has <strong>{blocked.join(' and ')}</strong>. Move or remove them first.
          </>
        ) : (
          'Its group chat becomes read-only. You can restore it later.'
        )}
      </ConfirmModal>
    </DashPage>
  )
}

function AssociationView({ open, association: a, onEdit, onClose }) {
  const members = useFarmers({ associationId: a?.id, limit: 5, page: 1 }, { enabled: Boolean(a) })
  const footer = a && (
    <>
      <Button variant="outline" to="/dashboard/inbox" className="min-h-[42px] py-0 font-semibold">Open group chat</Button>
      {a.status !== 'archived' && <Button onClick={onEdit} className="min-h-[42px] py-0">Edit</Button>}
    </>
  )
  const total = members.data?.meta.total ?? 0
  return (
    <Drawer open={open} eyebrow="Association" title={a?.name ?? 'Association'} onClose={onClose} footer={footer}>
      {!a ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <StatTiles items={[{ k: 'Farmers', v: a.farmerCount }, { k: 'Waiting', v: a.waitingCount }, { k: 'Farms', v: '—' }, { k: 'Harvest', v: '—' }]} />
          <DetailList
            rows={[
              { k: 'Municipality', v: a.municipality },
              { k: 'Group Manager', v: a.groupManager?.name ?? 'No Group Manager' },
              a.description && { k: 'Description', v: a.description },
              { k: 'Created', v: formatDate(a.createdAt) },
            ]}
          />
          <SectionTitle>Farmers</SectionTitle>
          {members.isPending ? (
            <Skeleton className="h-24 w-full" />
          ) : total === 0 ? (
            <p className="text-[13px] text-ink-3">No farmers yet.</p>
          ) : (
            <>
              <ul className="m-0 flex list-none flex-col p-0">
                {members.data.items.map((f) => {
                  const transfer = f.transferRequest?.association.id === a.id
                  const [label, tone] = transfer ? ['Transfer', 'blue'] : STATUS[f.status] ?? ['—', 'gray']
                  return (
                    <li key={f.id} className="flex items-center gap-3 border-b border-sand-soft py-2.5 last:border-0">
                      <span aria-hidden="true" className={cn('grid size-8 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold text-white', avatarFor(f.id))}>{f.initials}</span>
                      <span className="flex-1 text-sm font-medium">{f.name}</span>
                      <span className={cn('text-xs font-semibold', tone === 'blue' ? 'text-tone-blue-ink' : MEMBER_TONE[tone])}>{label}</span>
                    </li>
                  )
                })}
              </ul>
              <Link to="/dashboard/farmers" className="text-[13px] font-semibold no-underline">See all {total} farmers</Link>
            </>
          )}
        </>
      )}
    </Drawer>
  )
}

const toForm = (a) => ({ name: a?.name ?? '', municipality: a?.municipality ?? '', description: a?.description ?? '', groupManagerId: a?.groupManager?.id ?? null })

function AssociationForm({ open, association, onClose }) {
  const formId = useId()
  const create = useCreateAssociation()
  const update = useUpdateAssociation()
  return (
    <Drawer
      open={open}
      eyebrow="Association"
      title={association ? `Edit ${association.name}` : 'Add an association'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={association ? 'Save changes' : 'Create association'} />}
    >
      {open && <AssociationFields key={association?.id ?? 'new'} formId={formId} association={association} create={create} update={update} onClose={onClose} />}
    </Drawer>
  )
}

function AssociationFields({ formId, association, create, update, onClose }) {
  const locations = useLocations()
  // Group Managers who can take an association: anyone not archived (moving one empties their old association).
  const managers = useGroupManagers({ limit: 50, page: 1 })
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(associationFormSchema), defaultValues: toForm(association) })
  const onSubmit = (values) => {
    const done = (message) => () => {
      toast.success(message)
      onClose()
    }
    const onError = (error) => {
      if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
    }
    if (association) update.mutate({ id: association.id, ...values }, { onSuccess: done('Changes saved.'), onError })
    else create.mutate(values, { onSuccess: done('Association created with its group chat.'), onError })
  }
  const gmOptions = (managers.data?.items ?? [])
    .filter((g) => g.status !== 'archived')
    .map((g) => ({ value: g.id, label: g.association && g.association.id !== association?.id ? `${g.name} · now ${g.association.name}` : g.name }))

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="contents">
      <TextField id="as-name" label="Association name" placeholder="e.g. Torrijos Coffee Farmers" error={errors.name?.message} {...register('name')} />
      <Controller
        control={control}
        name="municipality"
        render={({ field }) => (
          <SearchSelect
            label="Municipality"
            icon="pin"
            placeholder="Select municipality"
            searchPlaceholder="Search municipality"
            options={(locations.data ?? []).map((m) => m.name)}
            value={field.value}
            onChange={field.onChange}
            error={errors.municipality?.message}
            ref={field.ref}
          />
        )}
      />
      <div>
        <Label htmlFor="as-desc">
          Description <span className="normal-case tracking-normal text-ink-4">(optional)</span>
        </Label>
        <textarea
          id="as-desc"
          rows={3}
          placeholder="Who they are, where they meet"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby="as-desc-hint"
          className="mt-2 w-full resize-y rounded-control border border-sand-strong px-[13px] py-2.5 text-sm focus:border-roast focus:outline-none focus:ring-3 focus:ring-roast/18 aria-invalid:border-danger-strong"
          {...register('description')}
        />
        <FieldHint id="as-desc-hint" error={errors.description?.message} />
      </div>
      <Controller
        control={control}
        name="groupManagerId"
        render={({ field }) => (
          <SearchSelect
            label="Group Manager"
            icon="home"
            placeholder="Assign later"
            searchPlaceholder="Search group manager"
            options={[{ value: '', label: 'Assign later' }, ...gmOptions]}
            value={field.value ?? ''}
            onChange={(v) => field.onChange(v || null)}
            error={errors.groupManagerId?.message}
            ref={field.ref}
          />
        )}
      />
      <p className="-mt-3 text-xs text-ink-3">{association ? 'Changing the Group Manager moves the group chat and farmer reviews to them.' : 'A group chat for the association is created with it.'}</p>
    </form>
  )
}
