import { format } from 'date-fns'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconCheck, IconDoubleCheck, IconFileText, IconMore, IconReply } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { InboxAvatar } from './InboxAvatar'

const EDIT_WINDOW_MS = 15 * 60 * 1000

/** Actions menu for your own message: Edit (15 minutes), Delete for everyone, Delete for me. Esc or a click outside closes it. */
function MessageMenu({ canEdit, onEdit, onDeleteEveryone, onDeleteMe, onClose }) {
  const ref = useRef(null)
  const [place, setPlace] = useState({ up: false, left: false })
  useLayoutEffect(() => {
    const menu = ref.current.getBoundingClientRect()
    const log = ref.current.closest('[role="log"]')?.getBoundingClientRect() ?? { top: 0, left: 0, bottom: window.innerHeight }
    // Below by default; up only without room below; left-aligned when right-aligning would cross the thread's edge (phones).
    setPlace({ up: menu.bottom > log.bottom && menu.top - menu.height - 38 > log.top, left: menu.left < log.left })
  }, [])
  useEffect(() => {
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    // The ⋯ button toggles the menu itself; any other click outside closes it.
    const onDown = (e) => !ref.current?.parentElement?.contains(e.target) && onClose()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])
  const item = 'flex min-h-[38px] w-full items-center rounded-[5px] px-3 text-left text-[13px] hover:bg-cream focus-visible:bg-cream'
  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        'absolute z-20 w-[200px] rounded-lg border border-sand bg-white p-1 shadow-[0_14px_30px_-14px_rgba(43,26,18,0.45)]',
        place.up ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]',
        place.left ? 'left-0' : 'right-0',
      )}
    >
      {canEdit && (
        <Button variant="bare" role="menuitem" onClick={onEdit} className={item}>
          Edit
        </Button>
      )}
      <Button variant="bare" role="menuitem" onClick={onDeleteEveryone} className={cn(item, 'text-logout')}>
        Delete for everyone
      </Button>
      <Button variant="bare" role="menuitem" onClick={onDeleteMe} className={item}>
        Delete for me
      </Button>
    </div>
  )
}

/** Sent / Delivered / Seen under my last message; groups add the readers' avatars (Seen by N). */
function Receipt({ receipt }) {
  const Icon = receipt.state === 'sent' ? IconCheck : IconDoubleCheck
  return (
    <span className={cn('inline-flex items-center gap-1 px-1 text-[11px]', receipt.state === 'seen' ? 'text-roast' : 'text-ink-5')}>
      <Icon aria-hidden="true" className="size-[15px]" strokeWidth={2} />
      {receipt.label}
      {receipt.seenBy.length > 1 && (
        <span aria-hidden="true" className="ml-1 inline-flex">
          {receipt.seenBy.slice(0, 3).map((s) =>
            s.avatarUrl ? (
              <img key={s.id} src={imageUrl(s.avatarUrl, 32)} alt="" className="-ml-1 size-4 rounded-full border-[1.5px] border-foam object-cover" />
            ) : (
              <span key={s.id} className="-ml-1 grid size-4 place-items-center rounded-full border-[1.5px] border-foam bg-caramel text-[7.5px] font-bold text-espresso">
                {s.initials}
              </span>
            ),
          )}
        </span>
      )}
    </span>
  )
}

/**
 * One message (DESIGN §8.2 MessageBubble): mine on the right in roast, theirs in white; a deleted one is a dashed tombstone.
 * Hover or focus shows Reply and, on your own, the ⋯ menu.
 * @param {{ message: object, chat: object, receipt?: object|null, onReply: () => void, onEdit: () => void, onDelete: (scope: 'everyone'|'me') => void }} props
 */
export function MessageBubble({ message: m, chat, receipt, onReply, onEdit, onDelete }) {
  const [menu, setMenu] = useState(null) // { canEdit } while the ⋯ menu is open
  const menuOpen = Boolean(menu)
  const group = chat.type === 'group'
  const showAuthor = !m.mine && chat.type !== 'direct'
  const act = (fn) => () => {
    setMenu(null)
    fn()
  }
  return (
    <div data-message={m.id} className={cn('group flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start', menuOpen && 'relative z-10')}>
      {group && !m.mine && (
        <InboxAvatar initials={m.sender.initials} colorId={m.sender.id} avatarUrl={m.sender.avatarUrl} px={28} className="size-7 text-[10.5px]" />
      )}
      <div className={cn('relative flex max-w-[72%] flex-col gap-[3px] max-[960px]:max-w-[82%]', m.mine ? 'items-end' : 'items-start')}>
        {showAuthor && <span className="px-1 text-[11.5px] text-ink-3">{m.author}</span>}
        <div className="flex items-center gap-1">
          {!m.deleted && (
            <div className={cn('flex gap-0.5 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100', menuOpen ? 'opacity-100' : 'opacity-0', m.mine ? 'order-0' : 'order-2')}>
              {chat.canPost && (
                <Button variant="bare" aria-label="Reply" onClick={onReply} className="grid size-[30px] place-items-center rounded-full text-ink-3 hover:bg-highlight">
                  <IconReply aria-hidden="true" className="size-[15px]" strokeWidth={2} />
                </Button>
              )}
              {m.mine && (
                <span className="relative inline-flex">
                  <Button
                    variant="bare"
                    aria-label="More actions"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    onClick={() => setMenu(menuOpen ? null : { canEdit: chat.canPost && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS })}
                    className={cn('grid size-[30px] place-items-center rounded-full text-ink-3', menuOpen ? 'bg-sand-soft' : 'hover:bg-highlight')}
                  >
                    <IconMore aria-hidden="true" className="size-[15px]" strokeWidth={2} />
                  </Button>
                  {menuOpen && (
                    <MessageMenu
                      canEdit={menu.canEdit}
                      onEdit={act(onEdit)}
                      onDeleteEveryone={act(() => onDelete('everyone'))}
                      onDeleteMe={act(() => onDelete('me'))}
                      onClose={() => setMenu(null)}
                    />
                  )}
                </span>
              )}
            </div>
          )}
          <div
            className={cn(
              'order-1 whitespace-pre-wrap break-words px-[13px] py-[9px] text-[13.5px] leading-[1.5]',
              m.mine ? 'rounded-[14px_14px_4px_14px]' : 'rounded-[14px_14px_14px_4px]',
              m.deleted ? 'border border-dashed border-sand-strong bg-transparent text-ink-3' : m.mine ? 'border border-roast bg-roast text-white' : 'border border-sand bg-white text-ink',
            )}
          >
            {m.replyTo && (
              <span className="mb-1.5 block rounded-[4px] border-l-[3px] border-caramel bg-caramel/15 px-2 py-1.5 text-xs">
                <strong>{m.replyTo.mine ? 'You' : m.replyTo.author}</strong>
                <span className="block truncate opacity-85">{m.replyTo.text}</span>
              </span>
            )}
            {m.attachments.map((file) =>
              file.kind === 'image' ? (
                <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="mb-1.5 block w-[220px] max-w-full overflow-hidden rounded-lg bg-photo">
                  <img src={imageUrl(file.url, 220)} alt={file.name ?? 'Photo'} className="aspect-[4/3] w-full object-cover" />
                </a>
              ) : (
                <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className={cn('mb-1.5 flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] underline-offset-2 hover:underline', m.mine ? 'bg-white/15 text-white hover:text-white' : 'bg-cream text-ink hover:text-ink')}>
                  <IconFileText aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
                  <span className="truncate">{file.name}</span>
                </a>
              ),
            )}
            {m.deleted ? <em>This message was deleted</em> : m.body}
          </div>
        </div>
        <span className="px-1 text-[11px] text-ink-5">
          <time dateTime={m.createdAt}>{format(new Date(m.createdAt), 'h:mm a')}</time>
          {m.editedAt && !m.deleted && ' · Edited'}
        </span>
        {receipt && <Receipt receipt={receipt} />}
      </div>
    </div>
  )
}
