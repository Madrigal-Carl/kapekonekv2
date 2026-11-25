import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { TextField } from '@/components/dashboard/RecordParts'
import { Alert } from '@/components/ui/Alert'
import { useSaveAdminSetting } from '@/hooks/useAdminSettings'
import { useUploadImage } from '@/hooks/useUploads'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
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

/** Settings → E-wallet: one card per provider with its account, QR and "Show at checkout". */
export function EwalletSettings({ ewallet, onSaved }) {
  const save = useSaveAdminSetting()
  const { register, control, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(ewalletFormSchema),
    defaultValues: { accounts: ewallet.accounts },
  })
  const submit = handleSubmit((body) =>
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

  return (
    <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
      {errors.accounts?.root?.message || errors.accounts?.message ? <Alert tone="danger">{errors.accounts.root?.message ?? errors.accounts.message}</Alert> : null}
      <div className="grid gap-4 md:grid-cols-[repeat(auto-fit,minmax(380px,1fr))]">
        {ewallet.accounts.map(({ provider }, i) => {
          const fieldErrors = errors.accounts?.[i] ?? {}
          return (
            <section key={provider} aria-label={provider} className="flex flex-wrap gap-[18px] rounded-card border border-sand bg-white p-[22px]">
              <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
                <h2 className="text-base font-semibold">{provider}</h2>
                <TextField id={`wallet-${i}-name`} label="Account name" maxLength={80} error={fieldErrors.accountName?.message} {...register(`accounts.${i}.accountName`)} />
                <TextField id={`wallet-${i}-number`} label="Account number" inputMode="tel" maxLength={30} error={fieldErrors.accountNumber?.message} {...register(`accounts.${i}.accountNumber`)} />
                <label className="flex cursor-pointer items-center gap-2 text-[13.5px]">
                  <input type="checkbox" className="size-[18px] accent-roast" {...register(`accounts.${i}.enabled`)} />
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
      {isDirty && <SaveBar formId={FORM_ID} pending={save.isPending} onDiscard={() => reset()} />}
    </form>
  )
}
