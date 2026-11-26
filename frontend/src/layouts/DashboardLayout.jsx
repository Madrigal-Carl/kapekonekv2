import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DashTopbar } from '@/components/dashboard/DashTopbar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { IconX } from '@/components/ui/icons'
import { AssociationWindow } from '@/components/dashboard/AssociationWindow'
import { ASSOCIATION_WINDOW, crumbsFor } from '@/constants/dashboardNav'
import { primaryRole } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'

/** Dashboard shell (DESIGN §8.1): sidebar ≥ 960px, a focus-trapped nav drawer below it, the top bar and the page. */
export function DashboardLayout() {
  const { roles } = useAuth()
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
        <Outlet />
      </div>
      {ASSOCIATION_WINDOW.has(role) && <AssociationWindow />}
    </div>
  )
}
