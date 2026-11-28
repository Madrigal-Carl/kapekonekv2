import { zodResolver } from '@hookform/resolvers/zod'
import { IconMail } from '@/components/ui/icons'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { homeFor } from '@/constants/roles'
import { useAddEmail, useAuth } from '@/hooks/useAuth'
import { useResendWithCooldown } from '@/hooks/useResendVerification'
import { AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { addEmailSchema } from '@/schemas/auth.schema'

const BUYER_PANEL = { eyebrow: 'One last step', title: 'Verify your email to start ordering.' }
const CREATED_PANEL = { eyebrow: 'One last step', title: 'Verify your email to open your dashboard.' }

/** "Kaluppa created a Group Manager account…" / "Liza Ramos created a farmer account for you in …" (VerifyEmailCreated board). */
function createdLine(user, roles) {
  const { name, isKaluppa } = user.createdBy
  if (roles.includes('group_manager')) return `${name} created a Group Manager account for you. Verify your email before you can use it.`
  const where = user.associationName ? ` in ${user.associationName}` : ''
  return `${isKaluppa ? 'Kaluppa' : name} created a farmer account for you${where}. Verify your email before you can use it.`
}

/**
 * Verify email (VerifyEmail.dc.html). Buyers and self-signup farmers get the buyer copy; accounts made by Kaluppa or a
 * Group Manager get the "created" variant. A username-only account (before Change 08) adds its email here first.
 */
export function VerifyEmail() {
  const { user, roles, mustVerify } = useAuth()
  const resend = useResendWithCooldown()
  const [confirmLogout, setConfirmLogout] = useState(false)

  if (!mustVerify) return <Navigate to={homeFor(roles)} replace />

  const created = Boolean(user.createdBy)
  const fixer = roles.includes('group_manager') || user.createdBy?.isKaluppa ? 'Kaluppa' : 'your Group Manager'
  const waiting = resend.secondsLeft > 0
  return (
    <AuthLayout panel={created ? CREATED_PANEL : BUYER_PANEL} width="max-w-[420px]">
      <span className="grid size-[52px] place-items-center rounded-card bg-caramel-tint text-caramel-ink">
        <IconMail aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </span>
      <Eyebrow className="mt-[22px]">Verify email</Eyebrow>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">{user.email ? 'Check your inbox' : 'Add your email'}</h1>
      {created && <p className="mt-2.5 rounded-md bg-crema px-3 py-2.5 text-[13.5px] leading-[1.55] text-ink-2">{createdLine(user, roles)}</p>}

      {user.email ? (
        <>
          <p className="mt-2.5 text-[14.5px] leading-[1.65] text-ink-2">
            We sent a verification link to <strong className="text-ink">{user.email}</strong>.{' '}
            {created ? 'Your dashboard stays locked until you open it.' : 'Open it to unlock your cart, orders and profile.'} The link works for 60 minutes.
          </p>

          {resend.isSuccess && <Alert className="mt-[18px]">A new verification link has been sent.</Alert>}
          {resend.error && resend.error.response?.status !== 429 && (
            <Alert tone="danger" className="mt-[18px]">{errorMessage(resend.error)}</Alert>
          )}

          <div className="mt-6 flex flex-col gap-2.5">
            <Button size="lg"
              onClick={resend.send}
              loading={resend.isPending}
              disabled={waiting}
              className={cn('', waiting && 'bg-disabled-bg text-disabled-ink opacity-100 hover:bg-disabled-bg hover:text-disabled-ink')}
            >
              {waiting ? `Resend available in ${resend.secondsLeft}s` : 'Resend verification email'}
            </Button>
            <Button variant="outline" onClick={() => setConfirmLogout(true)} className="py-3">
              Log out
            </Button>
          </div>
        </>
      ) : (
        <AddEmailForm onLogout={() => setConfirmLogout(true)} />
      )}

      <div className="mt-7 border-t border-sand-soft pt-5">
        <p className="text-[13px] leading-[1.6] text-ink-3">
          {created
            ? `You signed in with the default password. After verifying, change it in Settings → Security. Wrong email? Ask ${fixer} to fix it.`
            : 'You can still browse coffee while you wait. Adding to cart, checking out and reviewing need a verified email.'}
        </p>
        <Link to={created ? '/contact' : '/products'} className="mt-2 inline-block text-[13.5px] font-semibold no-underline">
          {created ? 'Contact Kaluppa →' : 'Browse coffee →'}
        </Link>
      </div>
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </AuthLayout>
  )
}

/** Username-only accounts: add an email, then the page switches to "Check your inbox". */
function AddEmailForm({ onLogout }) {
  const add = useAddEmail()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(addEmailSchema), defaultValues: { email: '' } })
  const onSubmit = (values) => add.mutate(values, { onError: (error) => applyServerErrors(error, setError, ['email']) })
  const failed = add.isError && !add.error.response?.data?.errors?.email
  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-2.5 flex flex-col gap-[18px]">
      <p className="text-[14.5px] leading-[1.65] text-ink-2">Your account has no email yet. Add one and we’ll send a verification link. Your dashboard stays locked until you open it.</p>
      {failed && <Alert tone="danger">{errorMessage(add.error)}</Alert>}
      <div>
        <Label htmlFor="add-email">Email</Label>
        <Input id="add-email" type="email" autoComplete="email" placeholder="name@gmail.com" className="mt-2" invalid={Boolean(errors.email)} aria-describedby="add-email-error" {...register('email')} />
        <FieldHint id="add-email-error" error={errors.email?.message} />
      </div>
      <div className="flex flex-col gap-2.5">
        <Button size="lg" type="submit" loading={add.isPending}>Send verification link</Button>
        <Button variant="outline" onClick={onLogout} className="py-3">Log out</Button>
      </div>
    </form>
  )
}
