import { Bell, LayoutDashboard, LogOut } from 'lucide-react'
import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { BeanMark } from '@/components/ui/BeanMark'
import { primaryRole, ROLE_LABELS } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'

/** Sidebar items that arrive in Phase 2, per role (Dashboard.dc.html). */
const SOON = {
  farmer: ['Sell beans', 'Shop supplies', 'My group', 'Messages'],
  group_manager: ['Farmers', 'Bean deliveries', 'Farm map', 'Messages'],
  kaluppa: ['Orders', 'Products', 'Delivery fees', 'Users & roles', 'Refunds'],
}

export function DashboardLayout() {
  const { user, roles } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const role = primaryRole(roles)
  const roleLabel = ROLE_LABELS[role]

  return (
    <div className="flex min-h-screen w-full flex-wrap items-stretch bg-foam">
      <aside aria-label="Dashboard navigation" className="flex max-w-[280px] flex-[1_1_248px] flex-col gap-5 border-r border-sand bg-white px-3.5 py-5 max-[808px]:max-w-none max-[808px]:border-b max-[808px]:border-r-0">
        <Link to="/dashboard/overview" className="flex items-center gap-2.5 px-2 text-ink no-underline hover:text-ink">
          <span className="grid size-[34px] place-items-center rounded-card bg-espresso text-caramel-light">
            <BeanMark className="size-[18px]" />
          </span>
          <span className="text-base font-semibold">KapeKonek</span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          <span className="px-2.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{roleLabel}</span>
          <Link
            to="/dashboard/overview"
            aria-current="page"
            className="flex items-center gap-2.5 rounded-control bg-roast px-3 py-2.5 text-sm font-medium text-white no-underline hover:text-white"
          >
            <LayoutDashboard aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
            Overview
          </Link>
          {(SOON[role] ?? []).map((item) => (
            <span key={item} aria-disabled="true" className="flex items-center justify-between gap-2.5 rounded-control px-3 py-2.5 text-sm text-ink-4">
              {item}
              <span className="rounded-[4px] bg-foam px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-3">Soon</span>
            </span>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2.5 border-t border-sand-soft p-2.5">
          <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-caramel-ink text-xs font-semibold text-white">{user.initials}</span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold">{user.fullName}</span>
            <span className="block text-xs text-ink-3">{roleLabel}</span>
          </div>
          <button
            type="button"
            aria-label="Log out"
            onClick={() => setConfirmLogout(true)}
            className="grid size-11 cursor-pointer place-items-center rounded-control text-ink-3 hover:bg-foam"
          >
            <LogOut aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <header className="flex h-16 items-center justify-between border-b border-sand bg-white px-5 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-[13px] text-ink-3">
            Dashboard <span aria-hidden="true" className="mx-1.5">/</span> <span className="font-medium text-ink">Overview</span>
          </nav>
          {/* shortcut: notifications open in M5; the bell is here to match the screen */}
          <button type="button" aria-label="Notifications" className="grid size-11 place-items-center rounded-control text-ink-2">
            <Bell aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        </header>
        <Outlet />
      </div>
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </div>
  )
}
