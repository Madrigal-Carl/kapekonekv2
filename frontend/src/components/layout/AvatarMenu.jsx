import { Button } from '@/components/ui/Button'
import { IconChevronDown, IconLogOut } from '@/components/ui/icons'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoutDialog } from '@/components/auth/LogoutDialog'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/cn'
import { ACCOUNT_LINKS } from './accountLinks'
import { imageUrl } from '@/lib/image'

const itemClasses = 'flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm no-underline hover:bg-crema focus-visible:bg-crema'

/**
 * Account dropdown: arrow keys move between items, Esc and outside clicks close it.
 * The buyer navbar uses the defaults; the dashboard top bar (DashTopbar.dc.html) passes its links, a name/role trigger and a role color.
 * @param {{ links?: Array<{ to: string, label: string, icon?: React.ComponentType }>, roleLabel?: string, avatarClassName?: string }} props
 */
export function AvatarMenu({ links = ACCOUNT_LINKS, roleLabel, avatarClassName = 'bg-roast' }) {
  const dashboard = Boolean(roleLabel)
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
      <Button variant="bare"
        ref={trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          dashboard
            ? 'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-full border-0 bg-transparent py-1 pl-1 pr-1.5 text-ink'
            : 'flex min-h-[42px] cursor-pointer items-center gap-1.5 rounded-full border border-sand bg-white py-1 pl-1 pr-1.5 text-ink-2'
        }
      >
        {/* Name = "Account menu for <name>" + the visible initials, so speech users can say "JD". */}
        <span className="sr-only">Account menu for {user.fullName}</span>
        <span className={cn('grid place-items-center overflow-hidden rounded-full text-xs font-semibold text-white', dashboard ? 'size-[34px]' : 'size-8', avatarClassName)}>
          {user.avatar?.url ? <img src={imageUrl(user.avatar.url, 40)} alt="" className="size-full object-cover" /> : user.initials}
        </span>
        {dashboard && (
          <span aria-hidden="true" className="flex flex-col items-start leading-[1.2] max-[960px]:hidden">
            <span className="text-[13px] font-semibold">{user.fullName}</span>
            <span className="text-[11.5px] text-ink-3">{roleLabel}</span>
          </span>
        )}
        <IconChevronDown aria-hidden="true" className={cn('transition-transform', dashboard ? 'size-[15px] text-ink-3' : 'size-4', open && 'rotate-180')} strokeWidth={2} />
      </Button>
      {open && (
        <div role="menu" aria-label="Account" className="absolute right-0 top-[calc(100%+8px)] z-50 w-60 rounded-card border border-sand bg-white p-1.5 shadow-dropdown">
          <div className="mb-1.5 border-b border-sand-soft px-3 pb-3 pt-2.5">
            <span className="block truncate text-sm font-semibold text-ink">{user.fullName}</span>
            <span className="block truncate text-xs text-ink-3">@{user.username}</span>
          </div>
          {links.map(({ to, label, icon: Icon }) => (
            <Link key={to} role="menuitem" to={to} onClick={() => setOpen(false)} className={cn(itemClasses, 'text-ink hover:text-ink', dashboard && 'min-h-10 py-2 text-[13.5px]')}>
              {Icon && <Icon aria-hidden="true" className="size-[17px] text-roast" strokeWidth={1.9} />}
              {label}
            </Link>
          ))}
          {!dashboard && <div className="mx-1 my-1.5 h-px bg-sand-soft" />}
          <Button variant="bare"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmLogout(true)
            }}
            className={cn(itemClasses, 'w-full cursor-pointer border-0 bg-transparent text-left', dashboard ? 'min-h-10 py-2 text-[13.5px] text-logout' : 'text-danger-ink')}
          >
            {!dashboard && <IconLogOut aria-hidden="true" className="size-[17px]" strokeWidth={1.9} />}
            Log out
          </Button>
        </div>
      )}
      <LogoutDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} />
    </div>
  )
}
