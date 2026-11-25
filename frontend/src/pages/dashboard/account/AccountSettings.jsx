import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Button } from '@/components/ui/Button'
import { IconAssociation, IconMapPin, IconPlus, IconShield, IconUser } from '@/components/ui/icons'
import { ACCOUNT_TABS } from '@/constants/dashboardNav'
import { primaryRole } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { DashPage } from '../overview/Overview'

const TAB_ICONS = { profile: IconUser, security: IconShield, association: IconAssociation, addresses: IconMapPin }

/** Account settings in the dashboard (FarmerAssociation.dc.html): page header, then the pill bar; each tab renders below. */
export function AccountSettings() {
  const { roles } = useAuth()
  const tabs = ACCOUNT_TABS[primaryRole(roles)] ?? []
  const { pathname } = useLocation()
  const current = tabs.find((t) => pathname.endsWith(`/account/${t.to}`))
  if (!current) return <Navigate to={`/dashboard/account/${tabs[0]?.to ?? 'profile'}`} replace />

  // The Addresses page opens its window from ?add=1, so the header button is a plain link.
  const actions = current.to === 'addresses' && (
    <Button as={Link} to="?add=1" leftIcon={<IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />}>
      Add address
    </Button>
  )
  return (
    <DashPage>
      <PageHeader eyebrow="Account settings" title={current.label} description={current.description} actions={actions} />
      <nav aria-label="Account settings" className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-card border border-sand bg-white p-[5px]">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.icon]
          return (
            <NavLink
              key={tab.to}
              to={`/dashboard/account/${tab.to}`}
              className={({ isActive }) =>
                cn(
                  'group inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[7px] px-4 text-[13.5px] no-underline',
                  isActive ? 'bg-crema font-semibold text-ink hover:text-ink' : 'font-medium text-ink-2 hover:bg-cream hover:text-ink',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4 text-ink-4 group-aria-[current=page]:text-roast" strokeWidth={1.9} />
              {tab.label}
            </NavLink>
          )
        })}
      </nav>
      <Outlet />
    </DashPage>
  )
}
