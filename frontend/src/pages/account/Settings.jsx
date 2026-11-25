import { zodResolver } from '@hookform/resolvers/zod'
import { IconMail } from '@/components/ui/icons'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { PasswordInput, PasswordRule } from '@/components/ui/PasswordInput'
import { useChangeEmail, useChangePassword } from '@/hooks/useAccount'
import { useAuth } from '@/hooks/useAuth'
import { AccountHeading } from '@/layouts/AccountLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { PASSWORD_RULE } from '@/schemas/rules'
import { changeEmailSchema, changePasswordSchema } from '@/schemas/account.schema'

/** White card with a header band, body and a footer band holding the submit button (Settings.dc.html). */
function SettingsCard({ id, title, intro, onSubmit, footer, bodyClassName, children }) {
  return (
    <form noValidate aria-labelledby={id} onSubmit={onSubmit} className="overflow-hidden rounded-card border border-sand bg-white">
      <div className="border-b border-sand-soft px-6 py-5">
        <h2 id={id} className="text-[17px] font-semibold">{title}</h2>
        <p className="mt-1 text-[13px] text-ink-3">{intro}</p>
      </div>
      <div className={bodyClassName}>{children}</div>
      <div className="flex justify-end border-t border-sand-soft bg-cream px-6 py-3.5">{footer}</div>
    </form>
  )
}

const onFail = (fields, setError) => (error) => {
  if (!applyServerErrors(error, setError, fields)) toast.error(errorMessage(error))
}

/** New email + current password. Success makes a buyer unverified, and the route guard opens /verify-email. */
function ChangeEmailForm({ email }) {
  const change = useChangeEmail()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { email: '', currentPassword: '' },
  })
  const onSubmit = (values) =>
    change.mutate(values, {
      onSuccess: () => toast.success('Check your new email for a verification link'),
      onError: onFail(['email', 'currentPassword'], setError),
    })

  return (
    <SettingsCard
      id="change-email"
      title="Change email"
      intro={<>Current: <strong className="text-ink">{email}</strong></>}
      onSubmit={handleSubmit(onSubmit)}
      bodyClassName="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[18px] px-6 py-[22px]"
      footer={<Button type="submit" pending={change.isPending} className="px-5">Update email</Button>}
    >
      <div>
        <Label htmlFor="newEmail">New email</Label>
        <Input id="newEmail" type="email" autoComplete="email" placeholder="you@example.com" className="mt-2" invalid={Boolean(errors.email)} aria-describedby="newEmail-error" {...register('email')} />
        <FieldHint id="newEmail-error" error={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="emailPassword">Current password</Label>
        <Input id="emailPassword" type="password" autoComplete="current-password" className="mt-2" invalid={Boolean(errors.currentPassword)} aria-describedby="emailPassword-error" {...register('currentPassword')} />
        <FieldHint id="emailPassword-error" error={errors.currentPassword?.message} />
      </div>
      <div className="col-span-full flex items-start gap-2.5 rounded-[6px] border border-notice-line bg-notice-bg px-3.5 py-3 text-[13px] text-notice-ink">
        <IconMail aria-hidden="true" className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
        <span>We'll send a verification link to the new address and take you to the verify page. You can't order until it's verified. Your old address gets a notice.</span>
      </div>
    </SettingsCard>
  )
}

/** Current, new and confirm. This session gets fresh cookies; other devices are signed out. */
function ChangePasswordForm() {
  const change = useChangePassword()
  const [show, setShow] = useState(false)
  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'password' })
  const onSubmit = ({ currentPassword, password: next }) =>
    change.mutate(
      { currentPassword, password: next },
      {
        onSuccess: () => {
          reset()
          setShow(false)
          toast.success('Your password is changed. Your other devices were signed out.')
        },
        onError: onFail(['currentPassword', 'password'], setError),
      },
    )

  return (
    <SettingsCard
      id="change-password"
      title="Change password"
      intro="You'll stay signed in here. Your other devices are signed out."
      onSubmit={handleSubmit(onSubmit)}
      bodyClassName="flex max-w-[520px] flex-col gap-[18px] px-6 py-[22px]"
      footer={<Button type="submit" pending={change.isPending} className="px-5">Update password</Button>}
    >
      <div>
        <Label htmlFor="currentPassword">Current password</Label>
        <Input id="currentPassword" type="password" autoComplete="current-password" className="mt-2" invalid={Boolean(errors.currentPassword)} aria-describedby="currentPassword-error" {...register('currentPassword')} />
        <FieldHint id="currentPassword-error" error={errors.currentPassword?.message} />
      </div>
      <div>
        <Label htmlFor="newPassword">New password</Label>
        <PasswordInput
          id="newPassword"
          autoComplete="new-password"
          placeholder="Type to see the rule turn green"
          show={show}
          onToggle={() => setShow((v) => !v)}
          className="mt-2"
          invalid={Boolean(errors.password)}
          aria-describedby="newPassword-rule"
          {...register('password')}
        />
        {errors.password && errors.password.message !== PASSWORD_RULE ? (
          <FieldHint id="newPassword-rule" error={errors.password.message} className="mt-2" />
        ) : (
          <PasswordRule id="newPassword-rule" value={password} invalid={Boolean(errors.password)} />
        )}
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input id="confirmPassword" type={show ? 'text' : 'password'} autoComplete="new-password" className="mt-2" invalid={Boolean(errors.confirmPassword)} aria-describedby="confirmPassword-error" {...register('confirmPassword')} />
        <FieldHint id="confirmPassword-error" error={errors.confirmPassword?.message} />
      </div>
    </SettingsCard>
  )
}

/** /settings (Settings.dc.html). */
/** Email and password. `embedded`: inside the dashboard's Account settings tabs, which bring their own header and width. */
export function Settings({ embedded = false }) {
  const { user } = useAuth()
  return (
    <>
      {!embedded && (
        <div className="mx-auto max-w-[1080px] px-4 pt-9 sm:px-8">
          <AccountHeading eyebrow="Account" title="Settings" />
        </div>
      )}
      <div className={embedded ? 'flex flex-col gap-6' : 'mx-auto flex max-w-[1080px] flex-col gap-6 px-4 pb-20 pt-6 sm:px-8'}>
        <div className="flex w-full min-w-0 flex-col gap-5">
          <ChangeEmailForm email={user.email} />
          <ChangePasswordForm />
        </div>
      </div>
    </>
  )
}
