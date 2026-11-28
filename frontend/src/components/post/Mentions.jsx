import { Button } from '@/components/ui/Button'
import { useMe } from '@/hooks/useMe'
import { cn } from '@/lib/cn'

// Hub @mentions (HubMention.dc.html, Change 08). State lives in hooks/useMentions.
const HINTS = {
  kaluppa: 'You can mention any farmer or Group Manager.',
  group_manager: 'You can mention Kaluppa and farmers in your association.',
  farmer: 'You can mention Kaluppa, your Group Manager and farmers in your association.',
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The list under the text box (HubMention.dc.html): a hint, up to 5 people, or "No one you can mention matches". */
export function MentionList({ id, mention, className }) {
  const me = useMe()
  if (!mention.open) return null
  return (
    <div id={id} role="listbox" aria-label="People you can mention" className={cn('overflow-hidden rounded-lg border border-sand bg-white shadow-[0_14px_30px_-16px_rgba(43,26,18,0.45)]', className)}>
      <div className="border-b border-sand-soft px-3 py-2 text-[11.5px] text-ink-3">{HINTS[me.role] ?? HINTS.farmer}</div>
      {mention.options.map((p, k) => {
        const on = k === Math.min(mention.active, mention.options.length - 1)
        return (
          <Button
            variant="bare"
            key={p.id}
            id={`${id}-${k}`}
            role="option"
            aria-selected={on}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()} // keep the caret in the text box
            onClick={() => mention.pick(p)}
            className={cn('flex h-auto w-full items-center justify-start gap-2.5 rounded-none px-3 py-2 text-left', on ? 'bg-highlight' : 'bg-white hover:bg-highlight')}
          >
            <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-roast text-[11px] font-semibold text-white">{p.initials}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-semibold">{p.name}</span>
              {p.sub && <span className="block text-xs font-normal text-ink-3">{p.sub}</span>}
            </span>
          </Button>
        )
      })}
      {!mention.pending && !mention.options.length && <p className="m-0 p-3 text-[12.5px] text-ink-3">No one you can mention matches “{mention.query}”.</p>}
    </div>
  )
}

/** "Mentioning @Ben Farmer — they’ll get a notification." */
export function MentionNote({ mention, className }) {
  if (!mention.named.length) return null
  return (
    <p className={cn('m-0 text-xs text-ink-2', className)}>
      Mentioning {mention.named.map((p) => <strong key={p.id} className="text-roast">@{p.name} </strong>)}— they’ll get a notification.
    </p>
  )
}

/**
 * Post or comment text with its mentions highlighted (Hub.dc.html): role and association in the tooltip.
 * shortcut: a highlighted span, not a link — there is no profile page to link to yet; make it a link when there is.
 * @param {{ text: string, mentions?: Array<{ _id: string, name: string, sub?: string }> }} props
 */
export function MentionText({ text, mentions = [] }) {
  if (!mentions?.length) return text
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length)
  const re = new RegExp(`(@(?:${names.map((m) => escapeRe(m.name)).join('|')}))`)
  return text.split(re).map((part, i) => {
    const who = part.startsWith('@') && names.find((m) => `@${m.name}` === part)
    if (!who) return part
    return (
      <span key={i} title={who.sub} className="rounded-[4px] bg-crema px-[3px] font-semibold text-roast">
        {part}
        {who.sub && <span className="sr-only"> ({who.sub})</span>}
      </span>
    )
  })
}
