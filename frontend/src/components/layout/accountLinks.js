import { KeyRound, MapPin, Package, User } from 'lucide-react'

/** Buyer account pages, in navbar-menu order (Navbar.dc.html). */
export const ACCOUNT_LINKS = [
  { to: '/profile', label: 'Profile', icon: User },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
  { to: '/settings', label: 'Settings', icon: KeyRound },
]
