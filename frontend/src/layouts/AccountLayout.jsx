import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'

/** Buyer account pages: navbar over the foam background, no footer (Orders/Checkout/Addresses screens). */
export function AccountLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="flex min-h-screen w-full flex-col bg-foam">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}

/** Eyebrow + H1 (+ optional line) at the top of an account page. */
export function AccountHeading({ eyebrow, title, children }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">{eyebrow}</div>
      <h1 className="mt-2.5 text-[28px] font-medium tracking-[-0.02em] sm:text-4xl">{title}</h1>
      {children && <p className="mt-1.5 text-sm text-ink-2">{children}</p>}
    </div>
  )
}
