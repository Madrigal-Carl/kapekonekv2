import { format } from 'date-fns'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconCheck, IconDoubleCheck, IconFileText, IconMore, IconReply } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { avatarColor } from './chatText'

const EDIT_WINDOW_MS = 15 * 60 * 1000

/** Actions menu for your own message: Edit (15 minutes), Delete for everyone, Delete for me. Esc or a click outside closes it. */
function MessageMenu({ canEdit, onEdit, onDeleteEveryone, onDeleteMe, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.querySelector('[role="menuitem"]')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => !ref.current?.contains(e.target) && onClose()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])
  const item = 'flex min-h-[38px] w-full items-center rounded-[5px] px-3 text-left text-[13px] hover:bg-cream focus-visible:bg-cream'
  return (
    <div ref={ref} role="menu" className="absolute bottom-[calc(100%-10px)] right-0 z-10 w-[200px] rounded-lg border border-sand bg-white p-1 shadow-[0_14px_30px_-14px_rgba(43,26,18,0.45)]">
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
          {receipt.seenBy.slice(0, 3).map((s) => (
            <span key={s.id} className="-ml-1 grid size-4 place-items-center rounded-full border-[1.5px] border-foam bg-caramel text-[7.5px] font-bold text-espresso">
              {s.initials}
            </span>
          ))}
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
    <div data-message={m.id} className={cn('group flex items-end gap-2', m.mine ? 'justify-end' : 'justify-start')}>
      {group && !m.mine && (
        <span aria-hidden="true" className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold text-white', avatarColor(m.sender.id))}>
          {m.sender.initials}
        </span>
      )}
      <div className={cn('relative flex max-w-[72%] flex-col gap-[3px] max-[960px]:max-w-[82%]', m.mine ? 'items-end' : 'items-start')}>
        {showAuthor && <span className="px-1 text-[11.5px] text-ink-3">{m.author}</span>}
        <div className="flex items-center gap-1">
          {!m.deleted && (
            <div className={cn('flex gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100', m.mine ? 'order-0' : 'order-2')}>
              {chat.canPost && (
                <Button variant="bare" aria-label="Reply" onClick={onReply} className="grid size-[30px] place-items-center rounded-full text-ink-3 hover:bg-highlight">
                  <IconReply aria-hidden="true" className="size-[15px]" strokeWidth={2} />
                </Button>
              )}
              {m.mine && (
                <Button variant="bare" aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenu(menuOpen ? null : { canEdit: chat.canPost && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS })} className="grid size-[30px] place-items-center rounded-full text-ink-3 hover:bg-highlight">
                  <IconMore aria-hidden="true" className="size-[15px]" strokeWidth={2} />
                </Button>
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
        {menuOpen && (
          <MessageMenu
            canEdit={menu.canEdit}
            onEdit={act(onEdit)}
            onDeleteEveryone={act(() => onDelete('everyone'))}
            onDeleteMe={act(() => onDelete('me'))}
            onClose={() => setMenu(null)}
          />
        )}
        <span className="px-1 text-[11px] text-ink-5">
          <time dateTime={m.createdAt}>{format(new Date(m.createdAt), 'h:mm a')}</time>
          {m.editedAt && !m.deleted && ' · Edited'}
        </span>
        {receipt && <Receipt receipt={receipt} />}
      </div>
    </div>
  )
}
