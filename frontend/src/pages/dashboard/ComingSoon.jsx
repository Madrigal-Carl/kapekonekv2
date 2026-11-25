import { IconHourglass } from '@/components/ui/icons'
import { useLocation } from 'react-router-dom'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { crumbsFor } from '@/constants/dashboardNav'
import { primaryRole } from '@/constants/roles'
import { useAuth } from '@/hooks/useAuth'
import { DashPage } from './overview/Overview'

// shortcut: holds the sidebar's routes until their milestone (M9–M12) replaces each with the real page.
export function ComingSoon() {
  const { roles } = useAuth()
  const [section, page] = crumbsFor(primaryRole(roles), useLocation().pathname)
  return (
    <DashPage>
      <PageHeader eyebrow={section} title={page} />
      <EmptyState icon={IconHourglass} title={`${page} is on its way`}>
        This page arrives in a later update of the dashboard.
      </EmptyState>
    </DashPage>
  )
}
