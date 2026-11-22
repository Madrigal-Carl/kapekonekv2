import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ACCOUNT_TABS } from '@/constants/dashboardNav'
import { primaryRole } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { DashPage } from '../overview/Overview'

/** Account settings in the dashboard (FarmerAssociation.dc.html header and tabs); each tab renders below. */
export function AccountSettings() {
  const { roles } = useAuth()
  const tabs = ACCOUNT_TABS[primaryRole(roles)] ?? []
  const { pathname } = useLocation()
  const current = tabs.find((t) => pathname.endsWith(`/account/${t.to}`))
  if (!current) return <Navigate to={`/dashboard/account/${tabs[0]?.to ?? 'profile'}`} replace />

  return (
    <DashPage>
      <PageHeader eyebrow="Account settings" title={current.label} description={current.description} />
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-sand">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={`/dashboard/account/${tab.to}`}
            className={({ isActive }) =>
              cn('-mb-px shrink-0 px-3.5 py-2.5 text-[13.5px] no-underline', isActive ? 'border-b-2 border-roast font-semibold text-ink hover:text-ink' : 'text-ink-3 hover:text-ink')
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </DashPage>
  )
}
