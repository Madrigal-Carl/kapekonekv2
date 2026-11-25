import { IconMail } from '@/components/ui/icons'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { homeFor } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { useResendWithCooldown } from '@/hooks/useResendVerification'
import { AuthLayout } from '@/layouts/AuthLayout'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'

const PANEL = { eyebrow: 'One last step', title: 'Verify your email to start ordering.' }

export function VerifyEmail() {
  const { user, roles, isVerified } = useAuth()
  const resend = useResendWithCooldown()
  const [confirmLogout, setConfirmLogout] = useState(false)

  if (isVerified) return <Navigate to={homeFor(roles)} replace />

  const waiting = resend.secondsLeft > 0
  return (
    <AuthLayout panel={PANEL} width="max-w-[420px]">
      <span className="grid size-[52px] place-items-center rounded-card bg-caramel-tint text-caramel-ink">
        <IconMail aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </span>
      <Eyebrow className="mt-[22px]">Verify email</Eyebrow>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">Check your inbox</h1>
      <p className="mt-2.5 text-[14.5px] leading-[1.65] text-ink-2">
        We sent a verification link to <strong className="text-ink">{user.email}</strong>. Open it to unlock your cart, orders and profile. The link works for 60 minutes.
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

      <div className="mt-7 border-t border-sand-soft pt-5">
        <p className="text-[13px] leading-[1.6] text-ink-3">
          You can still browse coffee while you wait. Adding to cart, checking out and reviewing need a verified email.
        </p>
        <Link to="/products" className="mt-2 inline-block text-[13.5px] font-semibold no-underline">
          Browse coffee →
        </Link>
      </div>
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </AuthLayout>
  )
}
