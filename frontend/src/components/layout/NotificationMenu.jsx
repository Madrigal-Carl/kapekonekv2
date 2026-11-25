import { IconBell } from '@/components/ui/icons'

import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useUnreadCount } from '@/hooks/useNotifications'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'

/** Navbar bell: unread count, a panel with the latest notifications, mark all read and load more. Esc / outside click close it. */
const NAVBAR_BADGE = 'right-[5px] top-[5px] h-[18px] min-w-[18px] bg-danger px-[5px] text-[10.5px] leading-[18px]'

/** @param {{ buttonClassName: string, badgeClassName?: string }} props the dashboard top bar passes its roast badge (DashTopbar.dc.html) */
export function NotificationMenu({ buttonClassName, badgeClassName = NAVBAR_BADGE }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()
  const count = useUnreadCount().data?.count ?? 0
  const list = useNotifications(open)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const navigate = useNavigate()
  const items = list.data?.pages.flatMap((page) => page.items) ?? []

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!root.current.contains(event.target)) setOpen(false)
    }
    // On the document: focus can drop to <body> (e.g. "Mark all as read" turns disabled after use).
    const onKey = (event) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openItem = (notification) => {
    if (!notification.readAt) markRead.mutate(notification._id)
    setOpen(false)
    if (notification.link) navigate(notification.link)
  }
  // Tabbing out of the panel closes it (non-modal popover).
  const onBlur = (event) => {
    if (open && event.relatedTarget && !root.current.contains(event.relatedTarget)) setOpen(false)
  }

  return (
    <div ref={root} className="relative" onBlur={onBlur}>
      <button
        ref={trigger}
        type="button"
        aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        <IconBell aria-hidden="true" className="size-5" strokeWidth={1.75} />
        {count > 0 && (
          <span aria-hidden="true" className={cn('absolute rounded-full text-center font-semibold text-white', badgeClassName)}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <section
          id={panelId}
          aria-label="Notifications"
          className="fixed inset-x-4 top-[72px] z-50 flex max-h-[min(560px,calc(100vh-96px))] flex-col overflow-hidden rounded-card border border-sand bg-white shadow-dropdown sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[380px]"
        >
          <header className="flex items-center justify-between gap-3 border-b border-sand-soft px-4 py-3">
            <h2 className="m-0 text-[15px] font-semibold">Notifications</h2>
            <button
              type="button"
              disabled={count === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="min-h-9 cursor-pointer rounded-control border-0 bg-transparent px-2 text-[13px] font-semibold text-roast hover:bg-crema disabled:cursor-default disabled:text-ink-4 disabled:hover:bg-transparent"
            >
              Mark all as read
            </button>
          </header>

          <div className="flex-1 overflow-y-auto">
            {list.isPending ? (
              <ul aria-busy="true" aria-label="Loading notifications" className="m-0 list-none p-0">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="border-b border-sand-soft px-4 py-3.5">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-crema" />
                    <div className="mt-2 h-3 w-full animate-pulse rounded bg-crema" />
                  </li>
                ))}
              </ul>
            ) : list.isError ? (
              <p role="alert" className="m-0 px-4 py-8 text-center text-[13.5px] text-ink-2">
                We couldn’t load your notifications.{' '}
                <button type="button" onClick={() => list.refetch()} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-roast underline">
                  Try again
                </button>
              </p>
            ) : items.length === 0 ? (
              <p className="m-0 px-4 py-10 text-center text-[13.5px] text-ink-2">No notifications yet. Order updates from Kaluppa show up here.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {items.map((n) => (
                  <li key={n._id} className="border-b border-sand-soft last:border-b-0">
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={cn('flex w-full cursor-pointer gap-3 border-0 px-4 py-3 text-left hover:bg-crema focus-visible:bg-crema', n.readAt ? 'bg-white' : 'bg-cream')}
                    >
                      <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-roast')} />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block text-[13.5px] text-ink', !n.readAt && 'font-semibold')}>
                          {!n.readAt && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </span>
                        {n.body && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-[1.5] text-ink-2">{n.body}</span>}
                        <span className="mt-1 block text-[11.5px] text-ink-3">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {list.hasNextPage && (
            <footer className="border-t border-sand-soft p-2">
              <button
                type="button"
                disabled={list.isFetchingNextPage}
                onClick={() => list.fetchNextPage()}
                className="min-h-10 w-full cursor-pointer rounded-control border-0 bg-transparent text-[13px] font-semibold text-roast hover:bg-crema disabled:text-ink-4"
              >
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </footer>
          )}
        </section>
      )}
    </div>
  )
}
