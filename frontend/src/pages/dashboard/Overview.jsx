import { Clock, Mail, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { primaryRole, ROLE_LABELS } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { useResendWithCooldown } from '@/hooks/useResendVerification'

const UPCOMING = {
  farmer: ['Sell beans to Kaluppa (kg limits)', 'Order fertilizer and seedlings', 'See your group and Group Manager', 'Messages and news feed'],
  group_manager: ['Manage your group’s farmers', 'Track bean deliveries to Kaluppa', 'Map of member farms', 'Group announcements'],
  kaluppa: ['Confirm, ship and complete orders', 'Manage products, stock, delivery fees and the payment QR', 'Mark refunds with reference numbers', 'Users, roles and permissions'],
}

/** "Good morning/afternoon/evening" by the clock in Marinduque. */
function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' }).format(now))
  if (hour < 12) return 'Good morning'
  return hour < 18 ? 'Good afternoon' : 'Good evening'
}

function UnverifiedBanner() {
  const resend = useResendWithCooldown()
  const waiting = resend.secondsLeft > 0
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-notice-line bg-notice-bg px-4 py-3.5">
      <span className="flex items-center gap-2.5 text-[13.5px] text-notice-ink">
        <Mail aria-hidden="true" className="size-[17px] shrink-0" strokeWidth={2} />
        {resend.isSuccess ? 'A new verification link has been sent. Check your inbox.' : "Your email isn't verified yet. You can keep using your dashboard."}
      </span>
      <Button variant="notice" onClick={resend.send} pending={resend.isPending} disabled={waiting} className="min-h-10 px-3.5 py-2 text-[13px]">
        {waiting ? `Resend in ${resend.secondsLeft}s` : 'Resend link'}
      </Button>
    </div>
  )
}

export function Overview() {
  const { user, roles, isVerified } = useAuth()
  const role = primaryRole(roles)
  const roleLabel = ROLE_LABELS[role]

  return (
    <main className="flex max-w-[1080px] flex-col gap-5 p-5 sm:p-8">
      {!isVerified && <UnverifiedBanner />}

      <div>
        <Eyebrow>{roleLabel}</Eyebrow>
        <h1 className="mt-2.5 text-[28px] font-medium tracking-[-0.02em] sm:text-[32px]">
          {greeting()}, {user.firstName}
        </h1>
      </div>

      <section className="flex flex-wrap items-start gap-7 rounded-card border border-sand bg-white p-7">
        <span className="grid size-[52px] shrink-0 place-items-center rounded-card bg-caramel-tint text-caramel-ink">
          <Sprout aria-hidden="true" className="size-6" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-[1_1_320px]">
          <h2 className="text-[19px] font-semibold">Your tools arrive in the next phase</h2>
          <p className="mt-1.5 text-sm leading-[1.65] text-ink-2">
            This dashboard is ready for your account. Here&apos;s what&apos;s coming for {role === 'kaluppa' ? roleLabel : `${roleLabel.toLowerCase()}s`}:
          </p>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
            {(UPCOMING[role] ?? []).map((item) => (
              <li key={item} className="flex items-start gap-2.5 rounded-[6px] border border-sand-soft bg-cream p-3 text-[13.5px] text-ink">
                <Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
