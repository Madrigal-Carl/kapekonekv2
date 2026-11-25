import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { PasswordInput, PasswordRule } from '@/components/ui/PasswordInput'
import { useResetPassword } from '@/hooks/useAuth'
import { AuthHeading, AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { resetPasswordSchema } from '@/schemas/auth.schema'
import { PASSWORD_RULE } from '@/schemas/rules'

const PANEL = { eyebrow: 'KapeKonek · Kaluppa, Marinduque', title: 'From Marinduque farms to your door.' }

function ExpiredLink() {
  return (
    <Alert tone="danger" className="mt-[22px]">
      This reset link has expired or was already used.{' '}
      <Link to="/forgot-password" className="font-semibold text-danger-text">
        Send a new link
      </Link>
    </Alert>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const email = params.get('email')
  const navigate = useNavigate()
  const reset = useResetPassword()
  const [show, setShow] = useState(false)
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })
  const password = useWatch({ control, name: 'password' })

  const onSubmit = ({ password: newPassword }) =>
    reset.mutate(
      { token, password: newPassword },
      {
        onSuccess: () => {
          toast.success('Your password was reset. Sign in with your new password.')
          navigate('/login', { replace: true })
        },
        onError: (error) => applyServerErrors(error, setError, ['password']),
      },
    )
  const expired = !token || reset.error?.response?.data?.errors?.token
  const otherError = reset.isError && !expired && !reset.error.response?.data?.errors?.password

  return (
    <AuthLayout panel={PANEL}>
      <AuthHeading eyebrow="Password reset" title="Choose a new password">
        {email ? (
          <>
            For <strong>{email}</strong>. You&apos;ll be signed out of other devices.
          </>
        ) : (
          "You'll be signed out of other devices."
        )}
      </AuthHeading>

      {expired ? (
        <ExpiredLink />
      ) : (
        <>
          {otherError && <Alert tone="danger" className="mt-6">{errorMessage(reset.error)}</Alert>}
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-[18px]">
            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                className="mt-2"
                show={show}
                onToggle={() => setShow((v) => !v)}
                toggleLabel={['Show passwords', 'Hide passwords']}
                invalid={Boolean(errors.password)}
                aria-describedby="pw-rule"
                {...register('password')}
              />
              {errors.password && errors.password.message !== PASSWORD_RULE ? (
                <FieldHint id="pw-rule" error={errors.password.message} />
              ) : (
                <PasswordRule id="pw-rule" value={password} invalid={Boolean(errors.password)} />
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
            <Button size="lg" type="submit" loading={reset.isPending}>
              Reset password
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  )
}
