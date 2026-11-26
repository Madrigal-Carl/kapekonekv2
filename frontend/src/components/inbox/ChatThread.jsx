import { differenceInCalendarDays } from 'date-fns'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconChevronLeft } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDeleteMessage, useMarkRead, useMessages } from '@/hooks/useInbox'
import { useInfiniteSentinel } from '@/hooks/useInfiniteSentinel'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { useTypingStore } from '@/stores/typing.store'
import { avatarColor, avatarShape, chatAvatarId, dayLabel, readOnlyNote, typingLine } from './chatText'
import { Composer } from './Composer'
import { MessageBubble } from './MessageBubble'

/** Names typing in this chat now, not counting me (entries expire in the store). */
function useTypingNames(conversationId, myId) {
  const entries = useTypingStore((s) => s.typing[conversationId])
  return Object.entries(entries ?? {})
    .filter(([id]) => id !== myId)
    .map(([, name]) => name)
}

/**
 * The open chat (Inbox.dc.html right pane, InboxMobile.dc.html chat screen).
 * @param {{ chat: object, myId: string, onBack: () => void }} props
 */
export function ChatThread({ chat, myId, onBack }) {
  const query = useMessages(chat.id)
  const markRead = useMarkRead()
  const remove = useDeleteMessage()
  const [replyTo, setReplyTo] = useState(null)
  const [editing, setEditing] = useState(null)
  const scroller = useRef(null)
  const sentinel = useInfiniteSentinel(query)
  const typing = useTypingNames(chat.id, myId)

  // Pages come newest first; the thread reads oldest first.
  const messages = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.items).toReversed(), [query.data])
  const newestId = messages.at(-1)?.id
  const oldestId = messages[0]?.id

  // Seen: on open and whenever a newer message arrives while the chat is on screen.
  const { mutate: read } = markRead
  useEffect(() => {
    if (newestId && document.visibilityState !== 'hidden') read(chat.id)
  }, [chat.id, newestId, read])

  // Keep the view pinned: new messages scroll to the bottom; older ones load above without jumping.
  const layout = useRef({ newestId: null, oldestId: null, height: 0 })
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const before = layout.current
    if (before.oldestId && oldestId !== before.oldestId && newestId === before.newestId) el.scrollTop += el.scrollHeight - before.height
    else if (newestId !== before.newestId) el.scrollTo?.({ top: el.scrollHeight })
    layout.current = { newestId, oldestId, height: el.scrollHeight }
  }, [newestId, oldestId, typing.length])

  const clear = () => {
    setReplyTo(null)
    setEditing(null)
  }
  const onDelete = (m, scope) => remove.mutate({ id: m.id, scope }, { onError: (e) => toast.error(errorMessage(e)), onSuccess: () => editing?.id === m.id && clear() })
  const receipt = chat.receipt
  const lastMineId = messages.findLast((m) => m.mine && !m.deleted)?.id

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-foam">
      <header className="flex items-center gap-3 border-b border-sand-soft bg-white px-4 py-3 max-[960px]:h-[60px] max-[960px]:gap-2.5 max-[960px]:border-sand max-[960px]:px-2.5 max-[960px]:py-0">
        <Button variant="bare" aria-label="Back to chats" onClick={onBack} className="hidden size-10 place-items-center rounded-full text-ink max-[960px]:grid">
          <IconChevronLeft aria-hidden="true" className="size-5" strokeWidth={2.2} />
        </Button>
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center text-[13px] font-semibold text-white', avatarShape(chat), avatarColor(chatAvatarId(chat)))}>
          {chat.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{chat.name}</h2>
          <span className="block truncate text-xs text-ink-3">{chat.sub}</span>
        </div>
      </header>

      <div ref={scroller} role="log" aria-label={`Messages with ${chat.name}`} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 max-[960px]:px-3 max-[960px]:py-3.5">
        <div ref={sentinel} aria-hidden="true" />
        {query.isFetchingNextPage && (
          <div className="flex items-center justify-center gap-2 text-xs text-ink-3">
            <span aria-hidden="true" className="size-3.5 animate-spin rounded-full border-2 border-sand-strong border-t-roast" />
            Loading earlier messages
          </div>
        )}
        {query.isPending ? (
          <div aria-label="Loading messages" className="flex flex-col gap-3">
            {['w-2/3', 'ml-auto w-1/2', 'w-3/5', 'ml-auto w-2/5'].map((w) => (
              <Skeleton key={w} className={cn('h-10 rounded-[14px]', w)} />
            ))}
          </div>
        ) : query.isError ? (
          <div role="alert" className="m-auto flex flex-col items-center gap-3 text-center text-sm text-ink-3">
            We couldn’t load these messages.
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <p className="m-auto text-center text-sm text-ink-3">No messages yet. Say hello!</p>
        ) : (
          messages.map((m, i) => {
            const newDay = i === 0 || differenceInCalendarDays(new Date(m.createdAt), new Date(messages[i - 1].createdAt)) !== 0
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="flex items-center gap-2.5 text-[11.5px] text-ink-5">
                    <span className="h-px flex-1 bg-sand" />
                    {dayLabel(m.createdAt)}
                    <span className="h-px flex-1 bg-sand" />
                  </div>
                )}
                <MessageBubble
                  message={m}
                  chat={chat}
                  receipt={m.id === lastMineId && receipt?.messageId === m.id ? receipt : null}
                  onReply={() => {
                    setEditing(null)
                    setReplyTo({ id: m.id, author: m.author, mine: m.mine, text: m.deleted ? 'This message was deleted' : m.body || (m.attachments[0]?.kind === 'image' ? 'Photo' : 'File') })
                  }}
                  onEdit={() => {
                    setReplyTo(null)
                    setEditing({ id: m.id, body: m.body })
                  }}
                  onDelete={(scope) => onDelete(m, scope)}
                />
              </Fragment>
            )
          })
        )}
        {typing.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-ink-3">
            <span aria-hidden="true" className="inline-flex gap-[3px] rounded-[12px] border border-sand bg-white px-2.5 py-2">
              <span className="size-1.5 animate-bounce rounded-full bg-typing-1" />
              <span className="size-1.5 animate-bounce rounded-full bg-typing-2 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-roast [animation-delay:300ms]" />
            </span>
            {typingLine(typing)}
          </div>
        )}
      </div>

      {chat.canPost ? (
        <Composer key={`${chat.id}:${editing?.id ?? ''}`} chat={chat} replyTo={replyTo} editing={editing} onDone={clear} />
      ) : (
        <div role="note" className="border-t border-sand-soft bg-cream p-4 text-center text-[13px] text-ink-2">
          {readOnlyNote(chat)}
        </div>
      )}
    </div>
  )
}
