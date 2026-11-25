import { IconKey, IconMapPin, IconOverview, IconPackage, IconUser } from '@/components/ui/icons'
import { homeFor } from '@/constants/roles'

/** Buyer account pages, in navbar-menu order (Navbar.dc.html). */
export const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Profile', icon: IconUser },
  { to: '/orders', label: 'Orders', icon: IconPackage },
  { to: '/addresses', label: 'Addresses', icon: IconMapPin },
  { to: '/settings', label: 'Settings', icon: IconKey },
]

/** A farmer in the store keeps their account pages in the dashboard (PHASE-2-SPEC §3.7). */
const DASHBOARD_LINKS = [
  { to: '/dashboard/overview', label: 'Dashboard', icon: IconOverview },
  { to: '/dashboard/orders', label: 'Orders', icon: IconPackage },
  { to: '/dashboard/account/addresses', label: 'Addresses', icon: IconMapPin },
  { to: '/dashboard/account/profile', label: 'Settings', icon: IconKey },
]

/** The navbar's account links for these roles. */
export const accountLinksFor = (roles) => (homeFor(roles) === '/' ? ACCOUNT_LINKS : DASHBOARD_LINKS)
