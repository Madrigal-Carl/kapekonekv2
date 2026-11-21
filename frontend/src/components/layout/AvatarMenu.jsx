import { ChevronDown, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { ACCOUNT_LINKS } from './accountLinks'

const itemClasses = 'flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm no-underline hover:bg-crema focus-visible:bg-crema'

/** Buyer account dropdown: arrow keys move between items, Esc and outside clicks close it. */
export function AvatarMenu() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const items = () => [...root.current.querySelectorAll('[role="menuitem"]')]

  useEffect(() => {
    if (!open) return undefined
    items()[0]?.focus()
    const onPointer = (event) => {
      if (!root.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false)
      trigger.current.focus()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const list = items()
      const next = list.indexOf(document.activeElement) + (event.key === 'ArrowDown' ? 1 : -1)
      list[(next + list.length) % list.length].focus()
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative ml-1" onKeyDown={open ? onKeyDown : undefined}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.fullName}`}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border border-sand bg-white py-1 pl-1 pr-1.5 text-ink-2"
      >
        <span className="grid size-8 place-items-center overflow-hidden rounded-full bg-roast text-xs font-semibold text-white">
          {user.avatar?.url ? <img src={user.avatar.url} alt="" className="size-full object-cover" /> : user.initials}
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', open && 'rotate-180')} strokeWidth={2} />
      </button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-card border border-sand bg-white p-1.5 shadow-dropdown">
          <div className="mb-1.5 border-b border-sand-soft px-3 pb-3 pt-2.5">
            <span className="block truncate text-sm font-semibold text-ink">{user.fullName}</span>
            <span className="block truncate text-xs text-ink-3">@{user.username}</span>
          </div>
          {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} role="menuitem" to={to} onClick={() => setOpen(false)} className={cn(itemClasses, 'text-ink hover:text-ink')}>
              <Icon aria-hidden="true" className="size-[17px] text-roast" strokeWidth={1.9} />
              {label}
            </Link>
          ))}
          <div className="mx-1 my-1.5 h-px bg-sand-soft" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmLogout(true)
            }}
            className={cn(itemClasses, 'w-full cursor-pointer border-0 bg-transparent text-left text-danger-ink')}
          >
            <LogOut aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />
            Log out
          </button>
        </div>
      )}
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </div>
  )
}
