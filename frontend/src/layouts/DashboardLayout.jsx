import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { DashTopbar } from '@/components/dashboard/DashTopbar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Modal } from '@/components/ui/Modal'
import { crumbsFor } from '@/constants/dashboardNav'
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
      <Modal open={navOpen} onClose={() => setNavOpen(false)} labelledBy="dash-nav-title" placement="left">
        <h2 id="dash-nav-title" className="sr-only">Navigation</h2>
        <Sidebar role={role} onNavigate={() => setNavOpen(false)} className="h-full overflow-y-auto" />
      </Modal>
      <div className="flex min-w-0 flex-1 flex-col">
        <DashTopbar role={role} crumbs={crumbsFor(role, pathname)} onMenu={() => setNavOpen(true)} menuOpen={navOpen} />
        <Outlet />
      </div>
    </div>
  )
}
