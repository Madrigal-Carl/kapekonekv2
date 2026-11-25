import { IconMail } from '@/components/ui/icons'
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Spinner } from '@/components/ui/Spinner'
import { homeFor } from '@/constants/roles'
import { useVerifyEmail } from '@/hooks/useAuth'
import { AuthLayout } from '@/layouts/AuthLayout'
import { useAuthStore } from '@/stores/auth.store'

const PANEL = { eyebrow: 'One last step', title: 'Verify your email to start ordering.' }

/** `/verify-email/confirm?token=` — the link from the email. Verifies once, then moves on. */
export function VerifyEmailConfirm() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const verify = useVerifyEmail()
  const navigate = useNavigate()
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return // the link is single-use, so never send it twice (StrictMode runs effects twice)
    started.current = true
    verify.mutate(token, {
      onSuccess: () => {
        const session = useAuthStore.getState().session
        toast.success(session ? 'Your email is verified.' : 'Your email is verified. Sign in to continue.')
        navigate(session ? homeFor(session.roles) : '/login', { replace: true })
      },
    })
  }, [token, verify, navigate])

  const failed = !token || verify.isError
  return (
    <AuthLayout panel={PANEL} width="max-w-[420px]">
      <span className="grid size-[52px] place-items-center rounded-card bg-caramel-tint text-caramel-ink">
        <IconMail aria-hidden="true" className="size-6" strokeWidth={1.75} />
      </span>
      <Eyebrow className="mt-[22px]">Verify email</Eyebrow>
      <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.02em]">
        {failed ? 'This link no longer works' : 'Verifying your email…'}
      </h1>
      {failed ? (
        <>
          <Alert tone="danger" className="mt-[18px]">
            This verification link has expired or was already used. Sign in and ask for a new link.
          </Alert>
          <Button size="lg" as={Link} to="/verify-email" fullWidth className="mt-6">
            Get a new link
          </Button>
        </>
      ) : (
        <p role="status" className="mt-4 flex items-center gap-2 text-[14.5px] text-ink-2">
          <Spinner className="size-4 text-roast" /> One moment.
        </p>
      )}
    </AuthLayout>
  )
}
