import { Link } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus } from '@/components/ui/icons'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { UsernameField } from '@/components/auth/UsernameField'
import { Drawer } from '@/components/dashboard/Drawer'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { DetailList, PersonHeader, SectionTitle, StatTiles, TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Skeleton } from '@/components/ui/Skeleton'
import { avatarFor } from '@/constants/records'
import {
  useArchiveGroupManager,
  useAssociationOptions,
  useCreateGroupManager,
  useGroupManager,
  useGroupManagers,
  useRestoreGroupManager,
  useUpdateGroupManager,
} from '@/hooks/useAssociations'
import { useTableParams } from '@/hooks/useTableParams'
import { USERNAME_INPUT, useUsernameStatus } from '@/hooks/useUsernameStatus'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { formatDate, formatDateTime } from '@/lib/date'
import { groupManagerFormSchema } from '@/schemas/records.schema'
import { FormFooter } from '../farmers/FarmerForm'
import { DashPage } from '../overview/Overview'

const PAGE_SIZE = 10
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'unassigned', label: 'No association' },
  { value: 'archived', label: 'Archived' },
]
const PILLS = { active: ['Active', 'green'], unassigned: ['No association', 'amber'], archived: ['Archived', 'gray'] }
const COLUMNS = [
  { key: 'gm', label: 'Group Manager', kind: 'person' },
  { key: 'association', label: 'Association' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status', kind: 'pill' },
  { key: 'created', label: 'Created', kind: 'muted' },
]
const FIELDS = ['firstName', 'middleName', 'lastName', 'username', 'contactNumber', 'email', 'associationId']

const toRow = (g) => ({
  id: g.id,
  label: g.name,
  gm: { name: g.name, sub: `@${g.username}`, initials: g.initials, avatarClassName: avatarFor(g.id) },
  association: g.association ? { main: g.association.name, sub: `${g.association.farmerCount} farmers` } : { main: 'Not assigned', sub: 'Assign from Edit' },
  contact: g.contactNumber,
  status: { label: PILLS[g.status][0], tone: PILLS[g.status][1] },
  created: formatDate(g.createdAt),
  actions: g.status === 'archived' ? ['view', 'restore'] : ['view', 'edit', 'archive'],
  record: g,
})

/** Kaluppa's Group Manager accounts (GroupManagers.dc.html, PHASE-2-SPEC §3.3). */
export function GroupManagers() {
  const query = useTableParams({ status: '' })
  const { params, set } = query
  const list = useGroupManagers({ q: params.q || undefined, status: params.status || undefined, page: params.page, limit: PAGE_SIZE })
  const openId = params.open && params.open !== 'new' ? params.open : null
  const detail = useGroupManager(openId)
  const archive = useArchiveGroupManager()
  const restore = useRestoreGroupManager()
  const [confirming, setConfirming] = useState(null) // { action: 'archive'|'restore', gm }

  const close = () => set({ open: null, mode: null })
  const drawer = params.open === 'new' || (openId && params.mode === 'edit') ? 'form' : openId ? 'view' : null
  const onAction = (action, row) => {
    if (action === 'archive' || action === 'restore') return setConfirming({ action, gm: row.record })
    set({ open: row.id, mode: action === 'edit' ? 'edit' : 'view' })
  }
  const confirm = () => {
    const { action, gm } = confirming
    ;(action === 'archive' ? archive : restore).mutate(gm.id, {
      onSuccess: () => {
        toast.success(`${gm.name} was ${action === 'archive' ? 'archived' : 'restored'}.`)
        setConfirming(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }
  const gm = confirming?.gm

  return (
    <DashPage>
      <PageHeader
        eyebrow="Records"
        title="Group Managers"
        description="Accounts that run each association. Only Kaluppa creates them."
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} className="min-h-[42px] py-0 font-semibold">
            <IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />
            Add Group Manager
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Group Managers"
        columns={COLUMNS}
        rows={list.data?.items.map(toRow)}
        status={{ label: 'Status', options: STATUS_OPTIONS }}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={{ title: 'No Group Managers yet', text: 'Add one to run an association and review its farmers.' }}
        searchPlaceholder="Search name, username or association"
        selectedId={params.open}
      />

      <GroupManagerView open={drawer === 'view'} gm={detail.data} onEdit={() => set({ mode: 'edit' })} onClose={close} />
      <GroupManagerForm open={drawer === 'form'} gm={params.open === 'new' ? null : detail.data} onClose={close} />

      <ConfirmModal
        open={Boolean(confirming)}
        variant={confirming?.action ?? 'archive'}
        title={`${confirming?.action === 'restore' ? 'Restore' : 'Archive'} ${gm?.name}?`}
        confirmLabel={confirming?.action === 'restore' ? 'Restore account' : 'Archive account'}
        cancelLabel="Keep"
        pending={archive.isPending || restore.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={confirm}
      >
        {confirming?.action === 'restore'
          ? 'They can sign in again. Assign an association from Edit if they need one.'
          : `They can’t sign in anymore.${gm?.association ? ` ${gm.association.name} will have no Group Manager, and Kaluppa reviews its farmer requests until you assign one.` : ''} You can restore the account later.`}
      </ConfirmModal>
    </DashPage>
  )
}

function GroupManagerView({ open, gm, onEdit, onClose }) {
  const footer = gm && (
    <>
      <Button as={Link} variant="outline" to={`/dashboard/inbox?to=${gm.id}`}>Message</Button>
      {gm.status !== 'archived' && <Button onClick={onEdit}>Edit</Button>}
    </>
  )
  return (
    <Drawer open={open} eyebrow="Group Manager" title={gm?.name ?? 'Group Manager'} onClose={onClose} footer={footer}>
      {!gm ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <PersonHeader id={gm.id} initials={gm.initials} name={gm.name} sub={[`@${gm.username}`, gm.contactNumber].filter(Boolean).join(' · ')} />
          <DetailList
            rows={[
              { k: 'Association', v: gm.association?.name ?? 'Not assigned' },
              { k: 'Email', v: gm.email },
              { k: 'Created', v: formatDate(gm.createdAt) },
              { k: 'Last sign-in', v: gm.lastSignInAt ? formatDateTime(gm.lastSignInAt) : 'Not yet' },
            ]}
          />
          {/* shortcut: Farms shows — until M9 records farms. */}
          <StatTiles items={[{ k: 'Farmers', v: gm.association?.farmerCount ?? 0 }, { k: 'Waiting', v: gm.association?.waitingCount ?? 0 }, { k: 'Farms', v: '—' }]} />
        </>
      )}
    </Drawer>
  )
}

const toForm = (g) => ({
  firstName: g?.firstName ?? '',
  middleName: g?.middleName ?? '',
  lastName: g?.lastName ?? '',
  username: g?.username ?? '',
  contactNumber: g?.contactNumber ?? '',
  email: g?.email ?? '',
  associationId: g?.association?.id ?? null,
})

function GroupManagerForm({ open, gm, onClose }) {
  const formId = useId()
  const create = useCreateGroupManager()
  const update = useUpdateGroupManager()
  return (
    <Drawer
      open={open}
      eyebrow="Group Manager"
      title={gm ? `Edit ${gm.name}` : 'Add a Group Manager'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={gm ? 'Save changes' : 'Create account'} />}
    >
      {open && <GroupManagerFields key={gm?.id ?? 'new'} formId={formId} gm={gm} create={create} update={update} onClose={onClose} />}
    </Drawer>
  )
}

function GroupManagerFields({ formId, gm, create, update, onClose }) {
  const options = useAssociationOptions()
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(groupManagerFormSchema),
    defaultValues: toForm(gm),
  })
  const [firstName, lastName, username] = useWatch({ control, name: ['firstName', 'lastName', 'username'] })
  const status = useUsernameStatus(username, errors.username?.message, { current: gm?.username, currentMessage: 'Their current username', emptyHint: 'Pick a suggestion or type one. They sign in with it.' })
  const onSubmit = (values) => {
    if (status.tone === 'taken') return // the status line already says why
    const done = (message) => () => {
      toast.success(message)
      onClose()
    }
    const onError = (error) => {
      if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
    }
    if (gm) update.mutate({ id: gm.id, ...values }, { onSuccess: done('Changes saved.'), onError })
    else create.mutate(values, { onSuccess: done('Account created. We emailed an invite link.'), onError })
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="contents">
      <SectionTitle>Name</SectionTitle>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField id="gm-first" label="First name" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <TextField id="gm-middle" label="Middle" optional autoComplete="off" error={errors.middleName?.message} {...register('middleName')} />
        <TextField id="gm-last" label="Last name" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <UsernameField
        id="gm-username"
        value={username}
        status={status}
        firstName={firstName}
        lastName={lastName}
        onPick={(name) => setValue('username', name, { shouldValidate: true, shouldDirty: true })}
        registration={register('username', USERNAME_INPUT)}
      />
      <TextField id="gm-phone" label="Contact number" type="tel" placeholder="09XX XXX XXXX" error={errors.contactNumber?.message} {...register('contactNumber')} />
      <TextField id="gm-email" label="Email" type="email" placeholder="name@gmail.com" hint={gm ? undefined : 'We send an invite link to set a password.'} error={errors.email?.message} {...register('email')} />
      <SectionTitle>Association</SectionTitle>
      <Controller
        control={control}
        name="associationId"
        render={({ field }) => (
          <SearchSelect
            label="Association"
            icon="tag"
            placeholder="Assign later"
            searchPlaceholder="Search association"
            options={[{ value: '', label: 'Assign later' }, ...(options.data ?? []).map((o) => ({ value: o.id, label: o.groupManager && o.id !== gm?.association?.id ? `${o.name} · now ${o.groupManager.name}` : o.name }))]}
            value={field.value ?? ''}
            onChange={(v) => field.onChange(v || null)}
            error={errors.associationId?.message}
            ref={field.ref}
          />
        )}
      />
      <p className="-mt-3 text-xs text-ink-3">When saved: a chat with Kaluppa is created. If you pick an association, they join its group chat and review its farmer requests.</p>
    </form>
  )
}
