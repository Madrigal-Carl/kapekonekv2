import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Check } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FileDrop } from '@/components/ui/FileDrop'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { useChangeAvatar, useProfile, useRemoveAvatar, useUpdateProfile } from '@/hooks/useAccount'
import { useUsernameStatus } from '@/hooks/useUsernameStatus'
import { AccountHeading } from '@/layouts/AccountLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { problemText } from '@/lib/fileCheck'
import { formatPhone } from '@/lib/format'
import { profileSchema } from '@/schemas/account.schema'
import { imageUrl } from '@/lib/image'

const FIELDS = ['firstName', 'middleName', 'lastName', 'username', 'contactNumber']

const toForm = (user) => ({
  firstName: user.firstName,
  middleName: user.middleName ?? '',
  lastName: user.lastName,
  username: user.username,
  contactNumber: formatPhone(user.contactNumber),
})

/** Avatar circle + Upload photo / Remove (Profile.dc.html top band). Saves straight away, apart from the form. */
function PhotoBand({ user }) {
  const id = useId()
  const change = useChangeAvatar()
  const remove = useRemoveAvatar()
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const busy = change.isPending || remove.isPending

  const choose = (file) => {
    setProgress(0)
    change.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: () => toast.success('Your photo is updated'),
        onError: (e) => setError(e.response ? errorMessage(e) : e.message),
      },
    )
  }

  const removePhoto = () =>
    remove.mutate(undefined, {
      onSuccess: () => toast.success('Your photo was removed'),
      onError: (e) => toast.error(errorMessage(e)),
    })

  return (
    <div className="flex flex-wrap items-center gap-5 border-b border-sand-soft p-6">
      <span className="grid size-[88px] shrink-0 place-items-center overflow-hidden rounded-full bg-roast text-[28px] font-semibold text-white">
        {user.avatar?.url ? <img src={imageUrl(user.avatar.url, 88)} alt="Your profile photo" className="size-full object-cover" /> : user.initials}
      </span>
      <div>
        <p className="text-base font-semibold">Profile photo</p>
        <p id={`${id}-hint`} className="mt-0.5 text-[12.5px] text-ink-3">
          Shows your initials until you upload one. JPG, PNG or WebP, up to 5 MB.
        </p>
        <div className="mt-3 flex gap-2.5">
          <FileDrop
            kind="image"
            onFile={choose}
            onError={setError}
            busy={busy}
            describedBy={`${id}-hint ${id}-error`}
            className="inline-flex min-h-10 items-center gap-2 rounded-control bg-roast px-3.5 py-[9px] text-[13px] font-medium text-white hover:bg-roast-hover"
          >
            <Camera aria-hidden="true" className="size-[15px]" strokeWidth={2} />
            <span aria-live="polite">{change.isPending ? `Uploading… ${progress}%` : 'Upload photo'}</span>
          </FileDrop>
          <Button
            variant="outline"
            onClick={removePhoto}
            disabled={!user.avatar?.url || change.isPending}
            pending={remove.isPending}
            className="min-h-10 border-sand px-3.5 py-[9px] text-[13px] disabled:text-st-cancelled-dot disabled:opacity-100"
          >
            Remove
          </Button>
        </div>
        <FieldHint id={`${id}-error`} error={problemText(error)} />
      </div>
    </div>
  )
}

/** /profile (Profile.dc.html). */
export function Profile() {
  const { data: user } = useProfile()
  const update = useUpdateProfile()
  const { register, control, handleSubmit, reset: resetForm, setError, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    values: toForm(user),
    resetOptions: { keepDirtyValues: true },
  })
  const username = useWatch({ control, name: 'username' })
  // resetOptions above apply to reset() too; Discard and Save must replace edited fields, not keep them.
  const reset = (values) => resetForm(values, { keepDirtyValues: false, keepFieldsRef: true })
  const status = useUsernameStatus(username, errors.username?.message, { current: user.username, takenHint: 'Try another one.' })

  const onSubmit = (values) =>
    update.mutate(values, {
      onSuccess: (saved) => {
        reset(toForm(saved))
        toast.success('Your profile is saved')
      },
      onError: (error) => {
        if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
      },
    })

  return (
    <>
      <div className="mx-auto max-w-[1080px] px-4 pt-9 sm:px-8">
        <AccountHeading eyebrow="Account" title="Profile" />
      </div>
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-4 pb-20 pt-6 sm:px-8">
        <div className="w-full min-w-0 overflow-hidden rounded-card border border-sand bg-white">
          <PhotoBand user={user} />

          <form noValidate onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[18px] p-6">
              <div>
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" autoComplete="given-name" className="mt-2" invalid={Boolean(errors.firstName)} aria-describedby="firstName-error" {...register('firstName')} />
                <FieldHint id="firstName-error" error={errors.firstName?.message} />
              </div>
              <div>
                <Label htmlFor="middleName">
                  Middle name <span className="normal-case tracking-normal text-ink-4">(optional)</span>
                </Label>
                <Input id="middleName" autoComplete="additional-name" className="mt-2" invalid={Boolean(errors.middleName)} aria-describedby="middleName-error" {...register('middleName')} />
                <FieldHint id="middleName-error" error={errors.middleName?.message} />
              </div>
              <div>
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" autoComplete="family-name" className="mt-2" invalid={Boolean(errors.lastName)} aria-describedby="lastName-error" {...register('lastName')} />
                <FieldHint id="lastName-error" error={errors.lastName?.message} />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <div className="relative mt-2">
                  <span aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-4">@</span>
                  <Input
                    id="username"
                    autoComplete="username"
                    aria-describedby="username-status"
                    invalid={status.tone === 'taken'}
                    className="pl-[30px]"
                    {...register('username', { setValueAs: (v) => v.toLowerCase(), onChange: (e) => { e.target.value = e.target.value.toLowerCase() } })}
                  />
                </div>
                <p
                  id="username-status"
                  aria-live="polite"
                  className={cn('mt-1.5 flex items-center gap-1.5 text-xs', { muted: 'text-ink-3', taken: 'text-danger-ink', available: 'text-success-ink' }[status.tone])}
                >
                  {status.tone === 'available' && <Check aria-hidden="true" className="size-[13px] shrink-0" strokeWidth={2.5} />}
                  {status.message}
                </p>
              </div>
              <div>
                <Label htmlFor="contactNumber">Contact number</Label>
                <Input
                  id="contactNumber"
                  inputMode="tel"
                  autoComplete="tel-national"
                  className="mt-2"
                  invalid={Boolean(errors.contactNumber)}
                  aria-describedby="contactNumber-hint"
                  {...register('contactNumber')}
                />
                <p id="contactNumber-hint" className={cn('mt-1.5 text-xs', errors.contactNumber ? 'text-danger-ink' : 'text-ink-3')}>
                  {errors.contactNumber?.message ?? 'Format 09XXXXXXXXX. Required before you place an order.'}
                </p>
              </div>
              <div>
                <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Email</span>
                <div className="mt-2 flex items-center justify-between gap-2.5 rounded-control border border-sand-soft bg-cream px-3 py-[11px] text-sm text-ink-2">
                  <span className="truncate">{user.email}</span>
                  {user.emailVerifiedAt ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-success-ink">
                      <Check aria-hidden="true" className="size-3" strokeWidth={2.5} />
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 text-[11px] font-semibold text-notice-ink">Not verified</span>
                  )}
                </div>
                <Link to="/settings" className="mt-1.5 inline-block text-[12.5px] font-semibold no-underline">
                  Change email in Settings
                </Link>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 border-t border-sand-soft bg-cream px-6 py-4">
              <Button variant="outline" onClick={() => reset(toForm(user))} disabled={update.isPending} className="px-[18px]">
                Discard
              </Button>
              <Button type="submit" pending={update.isPending} className="px-5">
                Save changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
