import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { TextField } from '@/components/dashboard/RecordParts'
import { Alert } from '@/components/ui/Alert'
import { ConfirmChangesModal } from '@/components/ui/ConfirmChangesModal'
import { useSaveAdminSetting } from '@/hooks/useAdminSettings'
import { useDirtyDiff, useSaveConfirm } from '@/hooks/useDirtyDiff'
import { useUploadImage } from '@/hooks/useUploads'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { orList } from '@/lib/payments'
import { ewalletFormSchema } from '@/schemas/setting.schema'
import { SaveBar } from './SettingsParts'

const FORM_ID = 'settings-ewallet'
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
const LABEL = 'block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2'

/** The QR image and its Replace/Upload button (`wallet_qr`, images up to 5 MB). */
function QrField({ provider, value, onChange, error }) {
  const id = useId()
  const upload = useUploadImage('wallet_qr')
  const [problem, setProblem] = useState(null)
  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    upload.mutate({ file }, { onSuccess: onChange, onError: (e) => setProblem(e.message || 'Upload failed. Try again.') })
  }
  const message = problem ?? error
  return (
    <div className="w-40">
      <span className={LABEL}>QR code</span>
      <div role="img" aria-label={`${provider} QR code`} className="mt-2 grid aspect-square place-items-center overflow-hidden rounded-card border border-sand bg-white">
        {value ? <img src={imageUrl(value.url, 320)} alt="" className="size-full object-contain" /> : <span className="px-3 text-center text-xs text-ink-4">No QR yet. Checkout shows a sample.</span>}
      </div>
      <label
        className={cn(
          'mt-2 flex min-h-[38px] w-full cursor-pointer items-center justify-center rounded-control border border-sand-strong bg-white text-[12.5px] font-semibold hover:bg-cream focus-within:outline-2 focus-within:outline-roast',
          upload.isPending && 'cursor-progress opacity-70',
        )}
      >
        {upload.isPending ? `Uploading ${upload.progress}%` : value ? 'Replace QR' : 'Upload QR'}
        <input type="file" accept={IMAGE_TYPES} aria-label={`${value ? 'Replace' : 'Upload'} ${provider} QR code`} aria-describedby={`${id}-e`} disabled={upload.isPending} onChange={pick} className="sr-only" />
      </label>
      <span className="mt-1 block text-[11.5px] text-ink-3">Image up to 5 MB</span>
      <span id={`${id}-e`} role={message ? 'alert' : undefined} className="mt-1 block text-xs text-danger-ink">{message}</span>
    </div>
  )
}

/** What the note says, from the saved accounts (never hard-coded provider names). */
function ProvidersNote({ accounts }) {
  const on = accounts.filter((a) => a.showAtCheckout).map((a) => a.provider)
  const off = accounts.filter((a) => !a.showAtCheckout).map((a) => a.provider)
  return (
    <p role="note" className="rounded-card bg-crema px-3.5 py-3 text-[13px] leading-[1.6] text-ink-2">
      Checkout, the landing page, the FAQ and emails only mention wallets that are shown at checkout.{' '}
      <strong>{`${off.length ? 'For now only ' : ''}${orList(on, 'and')} ${on.length > 1 ? 'are' : 'is'} on.`}</strong>
      {off.length > 0 && ` ${orList(off, 'and')} ${off.length > 1 ? 'stay' : 'stays'} saved here so you can switch ${off.length > 1 ? 'them' : 'it'} back on any time.`}
    </p>
  )
}

/** One diff row per provider field ("GCash account number: … → …"); the QR shows as "changed". */
const flat = ({ accounts = [] } = {}) =>
  Object.fromEntries(accounts.flatMap((a, i) => [[`${i}.accountName`, a.accountName], [`${i}.accountNumber`, a.accountNumber], [`${i}.qr`, a.qr?.url ?? ''], [`${i}.showAtCheckout`, a.showAtCheckout]]))
const labelsFor = (accounts) =>
  Object.fromEntries(
    accounts.flatMap(({ provider }, i) => [
      [`${i}.accountName`, `${provider} account name`],
      [`${i}.accountNumber`, `${provider} account number`],
      [`${i}.qr`, { label: `${provider} QR code`, sensitive: true }],
      [`${i}.showAtCheckout`, { label: `Show ${provider} at checkout`, format: (v) => (v ? 'On' : 'Off') }],
    ]),
  )

/** Settings → E-wallet: one card per provider with its account, QR and "Show at checkout". */
export function EwalletSettings({ ewallet, onSaved }) {
  const save = useSaveAdminSetting()
  const { register, control, handleSubmit, setError, reset, formState: { errors, defaultValues } } = useForm({
    resolver: zodResolver(ewalletFormSchema),
    defaultValues: { accounts: ewallet.accounts },
  })
  const changes = useDirtyDiff(flat(defaultValues), flat(useWatch({ control })), labelsFor(ewallet.accounts))
  const confirm = useSaveConfirm(true, (body) =>
    save.mutate(
      { section: 'ewallet', body },
      {
        onSuccess: (saved) => {
          reset(saved)
          onSaved()
        },
        onError: (error) => {
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error))
        },
      },
    ),
  )
  const submit = handleSubmit(confirm.submit)

  return (
    <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <ConfirmChangesModal {...confirm.modal} changes={changes} pending={save.isPending} />
      {errors.accounts?.root?.message || errors.accounts?.message ? <Alert tone="danger">{errors.accounts.root?.message ?? errors.accounts.message}</Alert> : null}
      <ProvidersNote accounts={ewallet.accounts} />
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
        {ewallet.accounts.map(({ provider, showAtCheckout }, i) => {
          const fieldErrors = errors.accounts?.[i] ?? {}
          return (
            <section key={provider} aria-label={provider} className="flex flex-wrap gap-[18px] rounded-card border border-sand bg-white p-[22px]">
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  {provider}
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', showAtCheckout ? 'bg-tone-green-bg text-tone-green-ink' : 'bg-tone-gray-bg text-tone-gray-ink')}>
                    {showAtCheckout ? 'Shown at checkout' : 'Hidden at checkout'}
                  </span>
                </h2>
                <TextField id={`wallet-${i}-name`} label="Account name" maxLength={80} error={fieldErrors.accountName?.message} {...register(`accounts.${i}.accountName`)} />
                <TextField id={`wallet-${i}-number`} label="Account number" inputMode="tel" maxLength={30} error={fieldErrors.accountNumber?.message} {...register(`accounts.${i}.accountNumber`)} />
                <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                  <input type="checkbox" className="size-[18px] accent-roast" {...register(`accounts.${i}.showAtCheckout`)} />
                  Show at checkout
                </label>
              </div>
              <Controller
                name={`accounts.${i}.qr`}
                control={control}
                render={({ field }) => <QrField provider={provider} value={field.value} onChange={field.onChange} error={fieldErrors.qr?.message} />}
              />
            </section>
          )
        })}
      </div>
      {changes.length > 0 && <SaveBar formId={FORM_ID} pending={save.isPending} onDiscard={() => reset()} />}
    </form>
  )
}
