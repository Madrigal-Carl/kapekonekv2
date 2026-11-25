import { IconArrowRight, IconShoppingBag } from '@/components/ui/icons'

import { Link, useLocation } from 'react-router-dom'
import { CartDrawer } from '@/components/order/CartDrawer'
import { BeanMark } from '@/components/ui/BeanMark'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { useRequireAuthAction } from '@/hooks/useRequireAuthAction'
import { cn } from '@/lib/cn'
import { useCartDrawer } from '@/stores/cart.store'
import { AvatarMenu } from './AvatarMenu'
import { MobileMenu } from './MobileMenu'
import { NotificationMenu } from './NotificationMenu'

const iconButton = 'relative grid size-11 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-ink-2 hover:bg-crema hover:text-ink-2'

/** Storefront header for guests and buyers (Navbar.dc.html). */
export function Navbar() {
  const { isAuthenticated } = useAuth()
  const requireAuth = useRequireAuthAction()
  const { pathname } = useLocation()
  const onProducts = pathname.startsWith('/products')
  const cartCount = useCart().data?.count ?? 0
  const showCart = useCartDrawer((s) => s.show)

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-sand bg-white/94 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-2 px-4 sm:gap-4 sm:px-8">
        <div className="flex items-center gap-10">
          <Link to="/" aria-label="KapeKonek home" className="flex items-center gap-2.5 text-ink no-underline hover:text-ink">
            <span className="grid size-[34px] place-items-center rounded-card bg-espresso text-caramel-light">
              <BeanMark className="size-[18px]" />
            </span>
            {/* Below 360px the mark alone keeps the cart, Get started and menu on one line. */}
            <span className="text-base font-semibold leading-[1.1] tracking-[-0.01em] max-[359px]:hidden">KapeKonek</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-7 max-[720px]:hidden">
            <Link
              to="/products"
              aria-current={onProducts ? 'page' : undefined}
              className={cn('relative py-[22px] text-[13.5px] no-underline hover:text-roast', onProducts ? 'font-semibold text-roast' : 'text-ink-2')}
            >
              Products
              {onProducts && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-roast" />}
            </Link>
            <Link to="/#how" className="py-[22px] text-[13.5px] text-ink-2 no-underline hover:text-roast">How it works</Link>
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button type="button" aria-label={`Cart, ${cartCount} items`} onClick={() => requireAuth(showCart)} className={iconButton}>
            <IconShoppingBag aria-hidden="true" className="size-5" strokeWidth={1.75} />
            {cartCount > 0 && (
              <span className="absolute right-1 top-1 h-[18px] min-w-[18px] rounded-full bg-roast px-[5px] text-center text-[10.5px] font-semibold leading-[18px] text-white">{cartCount}</span>
            )}
          </button>
          {isAuthenticated ? (
            <>
              <NotificationMenu buttonClassName={iconButton} />
              <div className="max-[720px]:hidden">
                <AvatarMenu />
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-2.5 text-[13.5px] text-ink-2 no-underline hover:text-roast max-[720px]:hidden">Log in</Link>
              <Link
                to="/register"
                className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-control bg-roast px-3 sm:px-3.5 py-[9px] text-[13.5px] font-medium text-white no-underline hover:bg-roast-hover hover:text-white"
              >
                Get started
                <IconArrowRight aria-hidden="true" className="size-3.5 max-[400px]:hidden" strokeWidth={2} />
              </Link>
            </>
          )}
          <MobileMenu />
        </div>
      </div>
      {isAuthenticated && <CartDrawer />}
    </header>
  )
}
