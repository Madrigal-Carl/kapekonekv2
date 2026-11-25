import { IconKey, IconMapPin, IconPackage, IconUser } from '@/components/ui/icons'

/** Buyer account pages, in navbar-menu order (Navbar.dc.html). */
export const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Profile', icon: IconUser },
  { to: '/orders', label: 'Orders', icon: IconPackage },
  { to: '/addresses', label: 'Addresses', icon: IconMapPin },
  { to: '/settings', label: 'Settings', icon: IconKey },
]
