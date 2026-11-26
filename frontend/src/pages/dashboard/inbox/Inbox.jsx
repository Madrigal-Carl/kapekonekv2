import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ChatList } from '@/components/inbox/ChatList'
import { ChatThread } from '@/components/inbox/ChatThread'
import { NewMessage } from '@/components/inbox/NewMessage'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useConversation, useConversations, useOpenDirect } from '@/hooks/useInbox'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { useTypingStore } from '@/stores/typing.store'

const wide = () => window.matchMedia?.('(min-width: 961px)').matches ?? true

/**
 * Inbox (Inbox.dc.html, InboxMobile.dc.html): two panes from 961px; on a phone the list, then the chat full screen with Back.
 * `/dashboard/inbox/:conversationId` opens a chat; `?to=<userId|kaluppa>` opens (or starts) the chat with that person.
 */
export function Inbox() {
  const { conversationId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const debounced = useDebouncedValue(q.trim(), 250)
  const list = useConversations({ filter, ...(debounced && { q: debounced }) })
  const current = useConversation(conversationId)
  const openDirect = useOpenDirect()
  const setOpen = useTypingStore((s) => s.setOpen)
  const typing = useTypingStore((s) => s.typing)
  const open = (id, replace = false) => navigate(`/dashboard/inbox/${id}`, { replace })

  useEffect(() => {
    setOpen(conversationId ?? null)
    return () => setOpen(null)
  }, [conversationId, setOpen])

  // Desktop always shows a chat: the first one when none is picked.
  const first = list.data?.[0]?.id
  useEffect(() => {
    if (!conversationId && first && !params.get('to') && wide()) navigate(`/dashboard/inbox/${first}`, { replace: true })
  }, [conversationId, first, params, navigate])

  // "Message" buttons elsewhere link to ?to=<userId>.
  const to = params.get('to')
  const { mutate: startChat } = openDirect
  useEffect(() => {
    if (!to) return
    startChat(to, {
      onSuccess: (chat) => navigate(`/dashboard/inbox/${chat.id}`, { replace: true }),
      onError: (error) => {
        toast.error(errorMessage(error))
        setParams({}, { replace: true })
      },
    })
  }, [to, startChat, navigate, setParams])

  const pick = (personId) =>
    openDirect.mutate(personId, {
      onSuccess: (chat) => {
        setComposing(false)
        open(chat.id)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  const typingIn = (id) => Object.keys(typing[id] ?? {}).some((who) => who !== user?.id)

  return (
    <main className="flex w-full flex-col gap-5 px-8 pb-14 pt-7 max-[960px]:p-0">
      <div className="max-[960px]:hidden">
        <PageHeader eyebrow="Community" title="Inbox" />
      </div>
      <section aria-label="Inbox" className="flex h-[760px] overflow-hidden rounded-[10px] border border-sand bg-white max-[960px]:h-[calc(100dvh-64px)] max-[960px]:rounded-none max-[960px]:border-0">
        <div className={cn('flex w-[340px] shrink-0 flex-col border-r border-sand-soft max-[960px]:w-full max-[960px]:border-0', conversationId && 'max-[960px]:hidden')}>
          <ChatList
            query={list}
            activeId={conversationId}
            filter={filter}
            onFilter={setFilter}
            q={q}
            onQ={setQ}
            onOpen={open}
            onNew={() => setComposing(true)}
            typingIn={typingIn}
          />
        </div>
        <div className={cn('flex min-w-0 flex-1', conversationId ? 'max-[960px]:fixed max-[960px]:inset-0 max-[960px]:z-40' : 'max-[960px]:hidden')}>
          {current.data ? (
            <ChatThread key={current.data.id} chat={current.data} myId={user?.id} onBack={() => navigate('/dashboard/inbox')} />
          ) : current.isError ? (
            <div role="alert" className="m-auto flex flex-col items-center gap-3 p-6 text-center text-sm text-ink-3">
              We couldn’t find that chat.
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/inbox')}>
                Back to chats
              </Button>
            </div>
          ) : (
            <p className="m-auto p-6 text-center text-sm text-ink-3">{conversationId || to ? 'Opening the chat…' : 'Pick a chat to read it here.'}</p>
          )}
        </div>
      </section>
      <NewMessage open={composing} onClose={() => setComposing(false)} onPick={pick} picking={openDirect.isPending} />
    </main>
  )
}
