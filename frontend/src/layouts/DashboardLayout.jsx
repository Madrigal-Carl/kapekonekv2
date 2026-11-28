import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { DashTopbar } from '@/components/dashboard/DashTopbar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconKey, IconX } from '@/components/ui/icons'
import { AssociationWindow } from '@/components/dashboard/AssociationWindow'
import { ASSOCIATION_WINDOW, crumbsFor } from '@/constants/dashboardNav'
import { primaryRole } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'

/** Still on KapeKonek@123 after verifying (Change 08): a quiet nudge until they change it. */
function DefaultPasswordBanner() {
  return (
    <p role="status" className="mx-4 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-sand bg-crema px-3.5 py-2.5 text-[13px] leading-normal text-ink-2 min-[720px]:mx-6">
      <IconKey aria-hidden="true" className="size-4 shrink-0 text-roast" strokeWidth={2} />
      <span>You’re still using the default password.</span>
      <Link to="/dashboard/account/security" className="font-semibold">Change it in Settings → Security</Link>
    </p>
  )
}

/** Dashboard shell (DESIGN §8.1): sidebar ≥ 960px, a focus-trapped nav drawer below it, the top bar and the page. */
export function DashboardLayout() {
  const { roles, user } = useAuth()
  const role = primaryRole(roles)
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen w-full items-stretch bg-foam">
      <Sidebar role={role} className="sticky top-0 h-screen shrink-0 overflow-y-auto max-[960px]:hidden" />
      <Modal open={navOpen} onClose={() => setNavOpen(false)} labelledBy="dash-nav-title" placement="left" className="relative w-[280px] max-w-[86%]">
        <h2 id="dash-nav-title" className="sr-only">Navigation</h2>
        <Button variant="ghost" iconOnly aria-label="Close navigation" onClick={() => setNavOpen(false)} className="absolute right-2.5 top-3.5 z-[2] size-10 text-ink-2 hover:bg-crema hover:text-ink-2">
          <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </Button>
        <Sidebar role={role} onNavigate={() => setNavOpen(false)} className="h-full w-full overflow-y-auto border-r-0" />
      </Modal>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashTopbar role={role} crumbs={crumbsFor(role, pathname)} onMenu={() => setNavOpen(true)} menuOpen={navOpen} />
        {user?.passwordIsDefault && !pathname.endsWith('/account/security') && <DefaultPasswordBanner />}
        <Outlet />
      </div>
      {ASSOCIATION_WINDOW.has(role) && <AssociationWindow />}
    </div>
  )
}
