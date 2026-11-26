import { Button } from '@/components/ui/Button'
import { IconCompose, IconSearch } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { listTime, previewLine } from './chatText'
import { ChatAvatar } from './InboxAvatar'

const FILTERS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['groups', 'Groups'],
]

/**
 * The chat list pane (Inbox.dc.html left pane, InboxMobile.dc.html list screen).
 * @param {{ query: import('@tanstack/react-query').UseQueryResult<object[]>, activeId?: string, filter: string, onFilter: (f: string) => void,
 *   q: string, onQ: (q: string) => void, onOpen: (id: string) => void, onNew: () => void, typingIn: (id: string) => boolean }} props
 */
export function ChatList({ query, activeId, filter, onFilter, q, onQ, onOpen, onNew, typingIn }) {
  const chats = query.data ?? []
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2.5 border-b border-sand-soft px-3.5 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chats</h2>
          <Button variant="outline" iconOnly aria-label="New message" onClick={onNew} className="size-[38px] rounded-full text-roast hover:text-roast">
            <IconCompose aria-hidden="true" className="size-[17px]" strokeWidth={2} />
          </Button>
        </div>
        <div className="relative">
          <IconSearch aria-hidden="true" className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-ink-4" strokeWidth={2} />
          <input
            type="search"
            value={q}
            onChange={(e) => onQ(e.target.value)}
            aria-label="Search co-farmers, your Group Manager or Kaluppa"
            placeholder="Search co-farmers, Group Manager, Kaluppa"
            className="min-h-10 w-full rounded-control border border-sand-strong bg-white py-2 pl-[34px] pr-3 text-[13.5px] outline-none focus:border-roast focus:ring-[3px] focus:ring-roast/20"
          />
        </div>
        <div role="group" aria-label="Filter chats" className="flex gap-1.5">
          {FILTERS.map(([key, label]) => (
            <Button
              key={key}
              variant="bare"
              aria-pressed={filter === key}
              onClick={() => onFilter(key)}
              className={cn(
                'min-h-8 rounded-full border px-3 text-[12.5px] font-semibold',
                filter === key ? 'border-espresso bg-espresso text-white' : 'border-sand-strong bg-white text-ink',
              )}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <ul aria-label="Loading chats" className="flex-1 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-3.5 py-[11px]">
              <Skeleton className="size-11 rounded-full" />
              <span className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2.5 w-4/5" />
              </span>
            </li>
          ))}
        </ul>
      ) : query.isError ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-ink-3">
          We couldn’t load your chats.
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : chats.length === 0 ? (
        <p className="flex flex-1 items-center justify-center p-6 text-center text-sm text-ink-3">
          {q || filter !== 'all' ? 'No chats match.' : 'No chats yet. Start one with New message.'}
        </p>
      ) : (
        <ul aria-label="Chats" className="flex-1 overflow-y-auto">
          {chats.map((chat) => {
            const on = chat.id === activeId
            const typing = typingIn(chat.id)
            const unread = chat.unread > 0
            return (
              <li key={chat.id}>
                <Button
                  variant="bare"
                  aria-current={on ? 'true' : undefined}
                  onClick={() => onOpen(chat.id)}
                  className={cn('flex w-full items-center gap-3 border-l-[3px] px-3.5 py-[11px] text-left text-ink', on ? 'border-roast bg-highlight' : 'border-transparent bg-white hover:bg-cream')}
                >
                  <ChatAvatar chat={chat} px={44} className="size-11 text-[13.5px]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2">
                      <span className={cn('truncate text-sm', unread ? 'font-bold' : 'font-semibold')}>{chat.name}</span>
                      {chat.lastMessage && <span className={cn('shrink-0 text-[11.5px]', unread ? 'text-roast' : 'text-ink-5')}>{listTime(chat.lastMessage.at)}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-[12.5px]', typing ? 'italic text-roast' : unread ? 'font-semibold text-ink' : 'text-ink-3')}>
                        {typing ? 'typing…' : previewLine(chat)}
                      </span>
                      {unread && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-roast px-1.5 text-[11px] font-semibold text-white">
                          <span className="sr-only">Unread messages: </span>
                          <span>{chat.unread}</span>
                        </span>
                      )}
                    </span>
                  </span>
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
