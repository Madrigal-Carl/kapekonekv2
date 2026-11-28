import { Button } from '@/components/ui/Button'
import { IconMenu, IconShoppingBag } from '@/components/ui/icons'
import { Link } from 'react-router-dom'
import { AvatarMenu } from '@/components/layout/AvatarMenu'
import { NotificationMenu } from '@/components/layout/NotificationMenu'
import { TOPBAR_CART } from '@/constants/dashboardNav'
import { ROLE_LABELS } from '@/constants/roles'
import { useCan } from '@/hooks/useCan'
import { useCart } from '@/hooks/useCart'

const AVATAR = { farmer: 'bg-avatar-green', group_manager: 'bg-caramel-ink', kaluppa: 'bg-espresso' }

/** Avatar menu links per role (DashTopbar.dc.html). */
const menuLinks = (role) =>
  role === 'farmer'
    ? [
        { to: '/dashboard/account/profile', label: 'Profile' },
        { to: '/dashboard/account/association', label: 'Account settings' },
        { to: '/dashboard/account/addresses', label: 'Addresses' },
        { to: '/products', label: 'Storefront' },
      ]
    : [
        { to: '/dashboard/account/profile', label: 'Profile' },
        { to: '/dashboard/account/security', label: 'Account settings' },
      ]

/**
 * Dashboard top bar (DashTopbar.dc.html): menu button under 960px, breadcrumb, cart (who may shop), bell and avatar menu.
 * @param {{ role: string, crumbs: [string, string], onMenu: () => void, menuOpen: boolean }} props
 */
export function DashTopbar({ role, crumbs, onMenu, menuOpen }) {
  const canShop = useCan('cart.manage') && TOPBAR_CART.has(role)
  const cartCount = useCart().data?.count ?? 0

  // Sticky on every page (DESIGN §8.7): above page content, below drawers, modals and the phone nav (z-50).
  return (
    <header data-sticky-bar className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-sand bg-white px-6 text-ink max-[960px]:px-4">
      <Button
        variant="outline"
        iconOnly
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        onClick={onMenu}
        className="hidden size-10 border-sand max-[960px]:inline-flex"
      >
        <IconMenu aria-hidden="true" className="size-[18px]" strokeWidth={2} />
      </Button>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 truncate text-[13px] text-ink-3">
        {crumbs[0]} <span aria-hidden="true" className="mx-1.5">/</span> <span aria-current="page" className="font-medium text-ink">{crumbs[1]}</span>
      </nav>
      {canShop && (
        <Button as={Link} variant="outline" size="sm" className="h-10 gap-1.5 text-[13px] font-medium"
          to="/products"
          
        >
          <IconShoppingBag aria-hidden="true" className="size-4 text-roast" strokeWidth={2} />
          Cart · {cartCount}
        </Button>
      )}
      <NotificationMenu
        buttonClassName="relative size-11 text-ink-2 hover:text-ink-2"
        badgeClassName="right-[7px] top-[7px] grid h-[17px] min-w-[17px] place-items-center border-2 border-white bg-roast px-1 text-[10px]"
      />
      <AvatarMenu links={menuLinks(role)} roleLabel={ROLE_LABELS[role]} avatarClassName={AVATAR[role]} />
    </header>
  )
}
