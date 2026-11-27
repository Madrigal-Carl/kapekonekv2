import { zodResolver } from '@hookform/resolvers/zod'
import { History } from '@/components/dashboard/History'
import { useEffect, useId, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { UsernameField } from '@/components/auth/UsernameField'
import { DocumentUpload } from '@/components/dashboard/DocumentUpload'
import { Drawer } from '@/components/dashboard/Drawer'
import { SectionTitle, TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { ConfirmChangesModal, NoChangesNote } from '@/components/ui/ConfirmChangesModal'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { uploadValue } from '@/constants/records'
import { useAssociationOptions } from '@/hooks/useAssociations'
import { useDirtyDiff, useSaveConfirm } from '@/hooks/useDirtyDiff'
import { useCreateFarmer, useUpdateFarmer } from '@/hooks/useFarmers'
import { USERNAME_INPUT, useUsernameStatus } from '@/hooks/useUsernameStatus'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { farmerFormSchema } from '@/schemas/records.schema'

const FIELDS = ['firstName', 'middleName', 'lastName', 'username', 'contactNumber', 'email', 'validId', 'landProof', 'associationId']
const ref = (doc) => doc && { url: doc.url, publicId: doc.publicId }
const toForm = (f) => ({
  firstName: f?.firstName ?? '',
  middleName: f?.middleName ?? '',
  lastName: f?.lastName ?? '',
  username: f?.username ?? '',
  contactNumber: f?.contactNumber ?? '',
  email: f?.email ?? '',
})
const LABELS = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  username: { label: 'Username', format: (v) => `@${v}` },
  contactNumber: 'Contact number',
  email: 'Email',
  validId: { label: 'Valid ID', sensitive: true }, // documents never show in a diff
  landProof: { label: 'Proof of land ownership', sensitive: true },
}

/**
 * Add or edit a farmer (Farmers.dc.html, FarmerForm board). A Group Manager's farmers join its association, approved;
 * Kaluppa picks the association. `onCreated` gets the API result (it may carry a one-time `temporaryPassword`).
 * @param {{ open: boolean, farmer?: object | null, association: { id: string, name: string } | null, onClose: () => void, onCreated: (result: object) => void }} props
 */
export function FarmerForm({ open, farmer = null, association, onClose, onCreated }) {
  const formId = useId()
  const create = useCreateFarmer()
  const update = useUpdateFarmer()
  const [unchanged, setUnchanged] = useState(Boolean(farmer))
  return (
    <Drawer
      open={open}
      eyebrow={farmer ? 'Farmer' : 'New farmer'}
      title={farmer ? `Edit ${farmer.name}` : 'Add a farmer'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={farmer ? 'Save changes' : 'Create farmer'} unchanged={unchanged} />}
    >
      {/* Keyed so a reopened form never shows the last farmer's values. */}
      {open && <FarmerFields key={farmer?.id ?? 'new'} formId={formId} create={create} update={update} farmer={farmer} association={association} onClose={onClose} onCreated={onCreated} onUnchanged={setUnchanged} />}
      {open && farmer && <History entityType="farmer" entityId={farmer.id} />}
    </Drawer>
  )
}

function FarmerFields({ formId, create, update, farmer, association, onClose, onCreated, onUnchanged }) {
  const editing = Boolean(farmer)
  const options = useAssociationOptions()
  const [associationId, setAssociationId] = useState('')
  const [docs, setDocs] = useState({ validId: uploadValue(farmer?.documents?.validId), landProof: uploadValue(farmer?.documents?.landProof) })
  const [changed, setChanged] = useState({})
  const [pickError, setPickError] = useState(null)
  const initial = useMemo(() => ({ ...toForm(farmer), validId: farmer?.documents?.validId?.url ?? '', landProof: farmer?.documents?.landProof?.url ?? '' }), [farmer])
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(farmerFormSchema),
    defaultValues: toForm(farmer),
  })
  const changes = useDirtyDiff(initial, { ...useWatch({ control }), validId: docs.validId?.url ?? '', landProof: docs.landProof?.url ?? '' }, LABELS)
  useEffect(() => onUnchanged(editing && changes.length === 0), [editing, changes.length, onUnchanged])
  const [firstName, lastName, username] = useWatch({ control, name: ['firstName', 'lastName', 'username'] })
  const status = useUsernameStatus(username, errors.username?.message, { current: farmer?.username, currentMessage: 'Their current username', emptyHint: 'Pick a suggestion or type one. They sign in with it.' })
  const setDoc = (key) => (doc) => {
    setDocs((d) => ({ ...d, [key]: doc }))
    setChanged((c) => ({ ...c, [key]: true }))
  }

  const onError = (error) => {
    if (error?.response?.data?.errors?.associationId) setPickError(error.response.data.errors.associationId)
    if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
  }
  const confirm = useSaveConfirm(editing, (body) =>
    update.mutate(body, {
      onSuccess: () => {
        toast.success('Changes saved.')
        onClose()
      },
      onError,
    }),
  )
  const onSubmit = (values) => {
    if (status.tone === 'taken') return // the status line already says why
    if (!editing && !association && !associationId) return setPickError('Choose an association')
    if (editing) {
      // Only new uploads go up: stored documents stay as they are.
      return confirm.submit({ id: farmer.id, ...values, ...(changed.validId && { validId: ref(docs.validId) }), ...(changed.landProof && { landProof: ref(docs.landProof) }) })
    }
    create.mutate(
      { ...values, validId: ref(docs.validId), landProof: ref(docs.landProof), ...(!association && { associationId }) },
      { onSuccess: onCreated, onError },
    )
  }

  return (
    <form id={formId} noValidate onSubmit={handleSubmit(onSubmit)} className="contents">
      <ConfirmChangesModal {...confirm.modal} changes={changes} pending={update.isPending} />
      {!editing &&
        (association ? (
          <p className="rounded-control bg-tone-green-bg px-3 py-2.5 text-[13px] text-tone-green-ink">
            Farmers you add join <strong>{association.name}</strong> and are approved right away.
          </p>
        ) : (
          <SearchSelect
            label="Association"
            icon="tag"
            placeholder="Choose an association"
            searchPlaceholder="Search association"
            options={(options.data ?? []).map((o) => ({ value: o.id, label: `${o.name} · ${o.municipality}` }))}
            value={associationId}
            onChange={(v) => {
              setAssociationId(v)
              setPickError(null)
            }}
            error={pickError}
          />
        ))}
      <SectionTitle>Name</SectionTitle>
      <div className="grid gap-5 min-[720px]:grid-cols-3">
        <TextField id="fm-first" label="First name" autoComplete="off" error={errors.firstName?.message} {...register('firstName')} />
        <TextField id="fm-middle" label="Middle" optional autoComplete="off" error={errors.middleName?.message} {...register('middleName')} />
        <TextField id="fm-last" label="Last name" autoComplete="off" error={errors.lastName?.message} {...register('lastName')} />
      </div>
      <UsernameField
        id="fm-username"
        value={username}
        status={status}
        firstName={firstName}
        lastName={lastName}
        onPick={(name) => setValue('username', name, { shouldValidate: true, shouldDirty: true })}
        registration={register('username', USERNAME_INPUT)}
      />
      <TextField id="fm-phone" label="Contact number" type="tel" placeholder="09XX XXX XXXX" error={errors.contactNumber?.message} {...register('contactNumber')} />
      <TextField
        id="fm-email"
        label="Email"
        optional
        type="email"
        placeholder="name@gmail.com"
        hint="With an email we send an invite link. Without one you get a temporary password to hand over."
        error={errors.email?.message}
        {...register('email')}
      />
      <SectionTitle>Documents</SectionTitle>
      <div className="grid gap-3 min-[720px]:grid-cols-2">
        <DocumentUpload compact label="Valid ID" short="valid ID" value={docs.validId} onChange={setDoc('validId')} error={errors.validId?.message} />
        <DocumentUpload compact label="Proof of land ownership" short="land proof" value={docs.landProof} onChange={setDoc('landProof')} error={errors.landProof?.message} />
      </div>
      <p className="-mt-3 text-xs text-ink-3">Documents are optional here because you vouch for this farmer. You can add them later.</p>
    </form>
  )
}

/** Cancel + submit for a drawer form; the submit button reaches the form through `form={formId}`. */
/** Cancel + Save; on an edit with nothing changed yet, Save is disabled with "No changes yet". */
export function FormFooter({ formId, onClose, pending, label, unchanged = false }) {
  const noteId = useId()
  return (
    <>
      {unchanged && <NoChangesNote id={noteId} />}
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button type="submit" form={formId} loading={pending} disabled={unchanged} aria-describedby={unchanged ? noteId : undefined}>{label}</Button>
    </>
  )
}
