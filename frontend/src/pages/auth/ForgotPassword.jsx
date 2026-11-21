import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { useForgotPassword } from '@/hooks/useAuth'
import { AuthHeading, AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { forgotPasswordSchema } from '@/schemas/auth.schema'

const PANEL = { eyebrow: 'KapeKonek · Kaluppa, Marinduque', title: 'From Marinduque farms to your door.' }

export function ForgotPassword() {
  const forgot = useForgotPassword()
  const { register, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })
  const onSubmit = (values) => forgot.mutate(values, { onError: (error) => applyServerErrors(error, setError, ['email']) })
  const failed = forgot.isError && !forgot.error.response?.data?.errors?.email

  return (
    <AuthLayout panel={PANEL}>
      <Link to="/login" className="inline-flex items-center gap-1.5 text-[13px] text-ink-3 no-underline">
        ← Back to sign in
      </Link>
      <AuthHeading className="mt-7" eyebrow="Password reset" title="Forgot your password?">
        Enter your email and we'll send you a link to reset it. The link works for 60 minutes.
      </AuthHeading>

      {forgot.isSuccess && (
        <Alert className="mt-[22px]">If an account uses that email, a reset link is on its way. Check your inbox and spam folder.</Alert>
      )}
      {failed && <Alert tone="danger" className="mt-[22px]">{errorMessage(forgot.error)}</Alert>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-[18px]">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-2"
            invalid={Boolean(errors.email)}
            aria-describedby="email-error"
            {...register('email')}
          />
          <FieldHint id="email-error" error={errors.email?.message} />
        </div>
        <Button type="submit" pending={forgot.isPending} className="py-[13px] text-[14.5px]">
          {forgot.isSuccess ? 'Resend link' : 'Email me a reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
