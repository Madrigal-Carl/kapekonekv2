import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { PasswordInput, PasswordRule } from '@/components/ui/PasswordInput'
import { RadioCard } from '@/components/ui/RadioCard'
import { useRegister, useUsernameSuggestions } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useUsernameStatus } from '@/hooks/useUsernameStatus'
import { AuthLayout } from '@/layouts/AuthLayout'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { registerSchema } from '@/schemas/auth.schema'
import { PASSWORD_RULE } from '@/schemas/rules'

const PANEL = {
  eyebrow: 'Join KapeKonek',
  title: 'Buy Marinduque coffee, or sell your harvest to Kaluppa.',
  text: 'Only the basics now. You can finish your profile later.',
  lines: 4,
  plant: true,
}

const ROLES = [
  { value: 'buyer', title: 'Buy coffee', description: 'Order coffee for delivery or pickup.' },
  { value: 'farmer', title: 'Sell as a farmer', description: 'Record your farms and sell beans to Kaluppa. Verify your email to start.' },
]

const FIELDS = ['firstName', 'middleName', 'lastName', 'username', 'email', 'contactNumber', 'password', 'role']

export function Register() {
  const signup = useRegister()
  const [showPasswords, setShowPasswords] = useState(false)
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'buyer', firstName: '', middleName: '', lastName: '', username: '', email: '', contactNumber: '', password: '', confirmPassword: '' },
  })
  const [role, firstName, lastName, username, password] = useWatch({ control, name: ['role', 'firstName', 'lastName', 'username', 'password'] })
  const status = useUsernameStatus(username, errors.username?.message)
  const suggestions = useUsernameSuggestions(useDebouncedValue(firstName.trim(), 500), useDebouncedValue(lastName.trim(), 500))

  // GuestRoute sends buyers to verify their email and farmers to their dashboard once the session is set.
  // The API's schema drops confirmPassword; only farmers send a contact number.
  const onSubmit = ({ contactNumber, ...values }) =>
    signup.mutate(values.role === 'farmer' ? { ...values, contactNumber } : values, { onError: (error) => applyServerErrors(error, setError, FIELDS) })
  const formError = signup.isError && !Object.keys(signup.error.response?.data?.errors ?? {}).length ? errorMessage(signup.error) : null

  return (
    <AuthLayout panel={PANEL} width="max-w-[480px]">
      <Eyebrow>Create account</Eyebrow>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">Create your account</h1>

      {formError && <Alert tone="danger" className="mt-6">{formError}</Alert>}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-[18px]">
        <fieldset className="m-0 border-0 p-0">
          <legend className="p-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">I want to</legend>
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => (
              <RadioCard key={r.value} value={r.value} checked={role === r.value} title={r.title} description={r.description} {...register('role')} />
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" autoComplete="given-name" className="mt-2" invalid={Boolean(errors.firstName)} aria-describedby="firstName-error" {...register('firstName')} />
            <FieldHint id="firstName-error" error={errors.firstName?.message} />
          </div>
          <div>
            <Label htmlFor="middleName">
              Middle <span className="normal-case tracking-normal text-ink-4">(optional)</span>
            </Label>
            <Input id="middleName" autoComplete="additional-name" className="mt-2" invalid={Boolean(errors.middleName)} aria-describedby="middleName-error" {...register('middleName')} />
            <FieldHint id="middleName-error" error={errors.middleName?.message} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" autoComplete="family-name" className="mt-2" invalid={Boolean(errors.lastName)} aria-describedby="lastName-error" {...register('lastName')} />
            <FieldHint id="lastName-error" error={errors.lastName?.message} />
          </div>
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
              className={cn('pl-[30px]', status.tone === 'available' && 'border-success-line')}
              {...register('username', { setValueAs: (v) => v.toLowerCase(), onChange: (e) => { e.target.value = e.target.value.toLowerCase() } })}
            />
          </div>
          <p
            id="username-status"
            aria-live="polite"
            className={cn(
              'mt-1.5 flex items-center gap-1.5 text-xs font-medium',
              { muted: 'text-ink-3', taken: 'text-danger-ink', available: 'text-success-ink' }[status.tone],
            )}
          >
            {status.message}
          </p>
          {suggestions.data?.length > 0 && (
            <div className="mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap">
              <span className="shrink-0 text-xs text-ink-3">Suggestions:</span>
              {suggestions.data.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setValue('username', name, { shouldValidate: true })}
                  className={cn(
                    'min-h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full border border-sand-strong px-[11px] py-[5px] text-[12.5px] text-ink',
                    username === name ? 'bg-crema' : 'bg-white',
                  )}
                >
                  @{name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="mt-2" invalid={Boolean(errors.email)} aria-describedby="email-error" {...register('email')} />
          <FieldHint id="email-error" error={errors.email?.message} />
        </div>

        {role === 'farmer' && (
          <div>
            <Label htmlFor="contactNumber">Contact number</Label>
            <Input id="contactNumber" type="tel" inputMode="tel" autoComplete="tel" placeholder="09XX XXX XXXX" className="mt-2" invalid={Boolean(errors.contactNumber)} aria-describedby="contactNumber-error" {...register('contactNumber')} />
            <FieldHint id="contactNumber-error" error={errors.contactNumber?.message} />
          </div>
        )}

        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="mt-2"
            show={showPasswords}
            onToggle={() => setShowPasswords((v) => !v)}
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
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password"
            className="mt-2"
            invalid={Boolean(errors.confirmPassword)}
            aria-describedby="confirmPassword-error"
            {...register('confirmPassword')}
          />
          <FieldHint id="confirmPassword-error" error={errors.confirmPassword?.message} />
        </div>

        <Button type="submit" pending={signup.isPending} className="py-[13px] text-[14.5px]">
          Create account
        </Button>
      </form>
      <p className="mt-[22px] border-t border-sand-soft pt-[18px] text-center text-sm text-ink-2">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold no-underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
