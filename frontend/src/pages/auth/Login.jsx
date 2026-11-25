import { zodResolver } from '@hookform/resolvers/zod'
import { IconArrowRight } from '@/components/ui/icons'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { useLogin } from '@/hooks/useAuth'
import { AuthHeading, AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { loginSchema } from '@/schemas/auth.schema'

const PANEL = {
  eyebrow: 'KapeKonek · Kaluppa, Marinduque',
  title: 'From Marinduque farms to your door.',
  text: 'Order coffee sourced by Kaluppa, delivered anywhere in Marinduque.',
  lines: 5,
  plant: true,
}

export function Login() {
  const login = useLogin()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '', remember: false },
  })
  // GuestRoute sends the user on once the session is set.
  const onSubmit = (values) => login.mutate(values, { onError: (error) => applyServerErrors(error, setError, ['identifier', 'password']) })
  const formError = login.isError && !login.error.response?.data?.errors?.identifier ? errorMessage(login.error) : null

  return (
    <AuthLayout panel={PANEL}>
      <Link to="/" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 no-underline">
        ← Back to KapeKonek
      </Link>
      <AuthHeading className="mt-7" eyebrow="Account access" title="Sign in to KapeKonek">
        Welcome back. Pick up where you left off.
      </AuthHeading>

      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-[18px]">
        <div>
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="you@example.com or juanadc"
            className="mt-2"
            invalid={Boolean(errors.identifier)}
            aria-describedby="identifier-error"
            {...register('identifier')}
          />
          <FieldHint id="identifier-error" error={errors.identifier?.message} />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-[12.5px] font-medium no-underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            className="mt-2"
            invalid={Boolean(errors.password)}
            aria-describedby="password-error"
            {...register('password')}
          />
          <FieldHint id="password-error" error={errors.password?.message} />
        </div>
        <label className="flex min-h-8 cursor-pointer items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" className="m-[3px_3px_3px_4px] size-[18px] accent-roast" {...register('remember')} />
          Remember me
        </label>
        <Button size="lg" type="submit" loading={login.isPending}>
          Sign in
          {!login.isPending && <IconArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />}
        </Button>
      </form>
      <p className="mt-6 border-t border-sand-soft pt-5 text-center text-sm text-ink-2">
        New to KapeKonek?{' '}
        <Link to="/register" className="font-semibold no-underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
