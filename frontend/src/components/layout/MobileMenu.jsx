import { IconLogOut, IconMenu, IconX } from '@/components/ui/icons'

import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { useAuth } from '@/hooks/useAuth'
import { ACCOUNT_LINKS } from './accountLinks'

const linkClasses = 'flex min-h-11 items-center gap-2.5 rounded-control px-3 text-[15px] text-ink no-underline hover:bg-crema hover:text-ink'

/** Small-screen menu (≤720 px): main links plus log in, or the buyer's account pages. Esc closes it. */
export function MobileMenu() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  // Open only for the page it was opened on, so any navigation closes it.
  const [openOn, setOpenOn] = useState(null)
  const open = openOn === location.key
  const setOpen = (next) => setOpenOn((typeof next === 'function' ? next(open) : next) ? location.key : null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const trigger = useRef(null)
  const panel = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    panel.current.querySelector('a, button')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpenOn(null)
        trigger.current.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-[721px]:hidden">
      <button
        ref={trigger}
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 cursor-pointer place-items-center rounded-control border border-sand bg-white text-ink hover:bg-crema"
      >
        {open ? <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} /> : <IconMenu aria-hidden="true" className="size-[18px]" strokeWidth={2} />}
      </button>
      {open && (
        <nav ref={panel} id="mobile-menu" aria-label="Menu" className="absolute inset-x-0 top-16 z-40 border-b border-sand bg-white px-4 pb-4 pt-2 shadow-dropdown">
          <Link to="/products" className={linkClasses}>Products</Link>
          <Link to="/#how" className={linkClasses}>How it works</Link>
          <div className="mx-1 my-2 h-px bg-sand-soft" />
          {isAuthenticated ? (
            <>
              {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={linkClasses}>
                  <Icon aria-hidden="true" className="size-[17px] text-roast" strokeWidth={1.9} />
                  {label}
                </Link>
              ))}
              <button type="button" onClick={() => setConfirmLogout(true)} className={`${linkClasses} w-full cursor-pointer border-0 bg-transparent text-danger-ink hover:text-danger-ink`}>
                <IconLogOut aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className={linkClasses}>Log in</Link>
          )}
        </nav>
      )}
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </div>
  )
}
