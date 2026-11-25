import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { PasswordInput, PasswordRule } from '@/components/ui/PasswordInput'
import { PageSpinner } from '@/components/ui/Spinner'
import { homeFor } from '@/constants/roles'
import { useAuth, useSetFirstPassword } from '@/hooks/useAuth'
import { AuthHeading, AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { firstPasswordSchema } from '@/schemas/auth.schema'
import { PASSWORD_RULE } from '@/schemas/rules'

const PANEL = { eyebrow: 'KapeKonek · Kaluppa, Marinduque', title: 'From Marinduque farms to your door.' }

/** First sign-in with a temporary password (PHASE-2-SPEC §3.2): the same layout as ResetPassword.dc.html. */
export function SetPassword() {
  const { isLoading, isAuthenticated, mustChangePassword, user, roles } = useAuth()
  const navigate = useNavigate()
  const setPassword = useSetFirstPassword()
  const [show, setShow] = useState(false)
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(firstPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'newPassword' })

  if (isLoading) return <PageSpinner />
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!mustChangePassword && !setPassword.isSuccess) return <Navigate to={homeFor(roles)} replace />

  const onSubmit = ({ newPassword }) =>
    setPassword.mutate(
      { newPassword },
      {
        onSuccess: (session) => {
          toast.success('Your password is set.')
          navigate(homeFor(session.roles), { replace: true })
        },
        onError: (error) => applyServerErrors(error, setError, ['newPassword']),
      },
    )
  const otherError = setPassword.isError && !setPassword.error.response?.data?.errors?.newPassword

  return (
    <AuthLayout panel={PANEL}>
      <AuthHeading eyebrow="First sign-in" title="Set a new password">
        Hi {user.firstName}. Your Group Manager gave you a temporary password. Choose your own to continue.
      </AuthHeading>
      {otherError && <Alert tone="danger" className="mt-6">{errorMessage(setPassword.error)}</Alert>}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-[18px]">
        <div>
          <Label htmlFor="newPassword">New password</Label>
          <PasswordInput
            id="newPassword"
            autoComplete="new-password"
            className="mt-2"
            show={show}
            onToggle={() => setShow((v) => !v)}
            toggleLabel={['Show passwords', 'Hide passwords']}
            invalid={Boolean(errors.newPassword)}
            aria-describedby="pw-rule"
            {...register('newPassword')}
          />
          {errors.newPassword && errors.newPassword.message !== PASSWORD_RULE ? (
            <FieldHint id="pw-rule" error={errors.newPassword.message} />
          ) : (
            <PasswordRule id="pw-rule" value={password} invalid={Boolean(errors.newPassword)} />
          )}
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            className="mt-2"
            invalid={Boolean(errors.confirmPassword)}
            aria-describedby="confirmPassword-error"
            {...register('confirmPassword')}
          />
          <FieldHint id="confirmPassword-error" error={errors.confirmPassword?.message} />
        </div>
        <Button size="lg" type="submit" loading={setPassword.isPending}>
          Set password and continue
        </Button>
      </form>
    </AuthLayout>
  )
}
