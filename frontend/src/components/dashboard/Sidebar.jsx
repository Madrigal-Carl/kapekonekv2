import { IconArrowUpRight, IconAssociation, NAV_ICONS } from '@/components/ui/icons'
import { Link, NavLink } from 'react-router-dom'
import { BeanMark } from '@/components/ui/BeanMark'
import { NAV } from '@/constants/dashboardNav'
import { ROLE_LABELS } from '@/constants/roles'
import { useBadges, useOrgCard } from '@/hooks/useDashboard'
import { cn } from '@/lib/cn'

/** The Sidebar.dc.html icon for a nav key (`NAV_ICONS` in components/ui/icons.js). */
export function NavIcon({ name, className = 'size-[17px]' }) {
  const Icon = NAV_ICONS[name]
  return <Icon aria-hidden="true" className={cn('shrink-0', className)} strokeWidth={1.9} />
}

/** The card's three lines and status color, per Sidebar.dc.html. Rejected farmers show the "none" card, like the screen. */
function orgLines(org) {
  if (!org) return null
  if (org.kind === 'group_manager') {
    return org.association
      ? ['Group Manager of', org.association.name, `${org.farmers} ${org.farmers === 1 ? 'farmer' : 'farmers'} · ${org.waiting} waiting`, 'text-caramel-badge']
      : ['Group Manager of', 'No association yet', 'Kaluppa assigns your association', 'text-caramel-badge']
  }
  if (org.status === 'approved') return ['Your association', org.association.name, 'Approved farmer', 'text-success-ink']
  if (org.status === 'pending') return ['Requested association', org.association.name, 'Waiting for approval', 'text-caramel-badge']
  return ['Association', 'Not in an association yet', 'Selling limit: 5 kg', 'text-caramel-badge']
}

function Badge({ count, active, alert }) {
  return (
    <span
      className={cn(
        'inline-grid h-5 min-w-[22px] place-items-center rounded-full px-1.5 text-[11px] font-semibold',
        active ? 'bg-white text-roast' : alert ? 'bg-roast text-white' : 'bg-caramel-tint text-notice-ink',
      )}
    >
      {count}
    </span>
  )
}

/**
 * Dashboard navigation (Sidebar.dc.html): sections per role, badges, and the association card.
 * @param {{ role: 'farmer'|'group_manager'|'kaluppa', onNavigate?: () => void, className?: string }} props
 */
export function Sidebar({ role, onNavigate, className }) {
  const badges = useBadges().data ?? {}
  const org = orgLines(useOrgCard().data)

  return (
    <aside aria-label="Dashboard navigation" className={cn('flex w-64 flex-col gap-[18px] border-r border-sand bg-white px-3 pb-4 pt-[18px] text-ink', className)}>
      <Link to="/dashboard/overview" onClick={onNavigate} className="flex items-center gap-2.5 px-2 py-0.5 text-ink no-underline hover:text-ink">
        <span className="grid size-[34px] place-items-center rounded-card bg-espresso text-caramel-light">
          <BeanMark className="size-[18px]" />
        </span>
        <span className="flex flex-col leading-[1.15]">
          <span className="text-base font-semibold">KapeKonek</span>
          <span className="text-[11px] text-ink-3">{ROLE_LABELS[role]} dashboard</span>
        </span>
      </Link>

      <nav className="flex flex-col gap-3.5">
        {(NAV[role] ?? []).map(([section, items]) => (
          <div key={section}>
            <span className="block px-3 pb-1 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">{section}</span>
            <ul className="m-0 flex list-none flex-col gap-px p-0">
              {items.map((it) => {
                const count = it.badge ? badges[it.badge] : 0
                const content = (active) => (
                  <>
                    <NavIcon name={it.icon} />
                    <span className="flex-1">{it.label}</span>
                    {count > 0 && <Badge count={count} active={active} alert={it.alert} />}
                    {it.external && <IconArrowUpRight aria-hidden="true" className="size-[13px] opacity-70" strokeWidth={2} />}
                  </>
                )
                const base = 'flex min-h-10 items-center gap-2.5 rounded-control px-3 py-2 text-sm no-underline'
                return (
                  <li key={it.to}>
                    {it.external ? (
                      <Link to={it.to} onClick={onNavigate} className={cn(base, 'font-medium text-ink-2 hover:bg-crema hover:text-ink-2')}>
                        {content(false)}
                      </Link>
                    ) : (
                      <NavLink
                        to={it.to}
                        onClick={onNavigate}
                        className={({ isActive }) => cn(base, isActive ? 'bg-roast font-semibold text-white hover:text-white' : 'font-medium text-ink-2 hover:bg-crema hover:text-ink-2')}
                      >
                        {({ isActive }) => content(isActive)}
                      </NavLink>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {org && (
        <div className="mt-auto flex items-start gap-2.5 rounded-card bg-crema p-3">
          <span aria-hidden="true" className="grid size-[30px] shrink-0 place-items-center rounded-md bg-white text-roast">
            <IconAssociation className="size-4" strokeWidth={1.9} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[11px] text-ink-3">{org[0]}</span>
            <span className="text-[13px] font-semibold leading-[1.3]">{org[1]}</span>
            <span className={cn('mt-1 text-[11.5px] font-semibold', org[3])}>{org[2]}</span>
          </span>
        </div>
      )}
    </aside>
  )
}
