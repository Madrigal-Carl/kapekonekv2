import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { IconSearch, IconX } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePeople } from '@/hooks/useInbox'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { cn } from '@/lib/cn'
import { avatarColor } from './chatText'

/**
 * "New message": search the people you may message (co-farmers, your Group Manager, Kaluppa) and open the chat.
 * @param {{ open: boolean, onClose: () => void, onPick: (personId: string) => void, picking: boolean }} props
 */
export function NewMessage({ open, onClose, onPick, picking }) {
  const [q, setQ] = useState('')
  const debounced = useDebouncedValue(q, 250)
  const people = usePeople(debounced, open)
  const list = people.data ?? []
  return (
    <Modal open={open} onClose={onClose} labelledBy="new-message-title" className="w-full max-w-[440px]">
      <div className="flex items-center justify-between border-b border-sand-soft px-5 py-4">
        <h2 id="new-message-title" className="text-lg font-semibold">
          New message
        </h2>
        <Button variant="bare" aria-label="Close" onClick={onClose} className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-cream">
          <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </Button>
      </div>
      <div className="p-4">
        <div className="relative">
          <IconSearch aria-hidden="true" className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-ink-4" strokeWidth={2} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search people you can message"
            placeholder="Search co-farmers, Group Manager, Kaluppa"
            className="min-h-10 w-full rounded-full border border-sand-strong bg-cream py-2 pl-[34px] pr-3.5 text-[13px] outline-none focus:border-roast focus:ring-[3px] focus:ring-roast/20"
          />
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto px-2 pb-3">
        {people.isPending ? (
          <div aria-label="Loading people" className="flex flex-col gap-3 p-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : people.isError ? (
          <p role="alert" className="p-4 text-center text-sm text-ink-3">
            We couldn’t load people. Close this and try again.
          </p>
        ) : list.length === 0 ? (
          <p className="p-4 text-center text-sm text-ink-3">No one matches “{q}”.</p>
        ) : (
          <ul aria-label="People">
            {list.map((p) => (
              <li key={p.id}>
                <Button variant="bare" disabled={picking} onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-cream disabled:opacity-60">
                  <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center text-[13px] font-semibold text-white', p.id === 'kaluppa' ? 'rounded-[12px]' : 'rounded-full', avatarColor(p.id))}>
                    {p.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-ink-3">{p.sub}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
