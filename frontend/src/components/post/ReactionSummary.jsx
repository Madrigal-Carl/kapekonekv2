import { Heart, Star, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/cn'

const TYPES = [
  { key: 'like', label: 'Like', icon: ThumbsUp, tile: 'bg-roast text-white' },
  { key: 'love', label: 'Love', icon: Heart, tile: 'bg-danger-strong text-white' },
  { key: 'celebrate', label: 'Celebrate', icon: Star, tile: 'bg-caramel text-espresso' },
]

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Stacked reaction icons, "N reactions" (expands to a breakdown) and the comment count. */
export function ReactionSummary({ counts = {}, commentCount = 0 }) {
  const [open, setOpen] = useState(false)
  const present = TYPES.filter((t) => counts[t.key] > 0)
  const total = present.reduce((sum, t) => sum + counts[t.key], 0)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {present.length > 0 && (
            <span aria-hidden="true" className="inline-flex">
              {present.map(({ key, icon: Icon, tile }, i) => (
                <span key={key} className={cn('grid size-6 place-items-center rounded-full border-2 border-white', tile, i > 0 && '-ml-1.5')}>
                  <Icon className="size-3 fill-current" strokeWidth={0} />
                </span>
              ))}
            </span>
          )}
          {total > 0 ? (
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="cursor-pointer border-0 bg-transparent px-0 py-1.5 text-[13.5px] text-ink-2">
              {plural(total, 'reaction')}
            </button>
          ) : (
            <span className="text-[13.5px] text-ink-3">No reactions yet</span>
          )}
        </div>
        <span className="text-[13.5px] text-ink-2">{plural(commentCount, 'comment')}</span>
      </div>
      {open && (
        <ul aria-label="Reaction breakdown" className="m-0 flex list-none flex-wrap gap-2 px-5 pb-3.5">
          {present.map(({ key, label }) => (
            <li key={key} className="rounded-full border border-sand bg-foam px-3 py-[5px] text-[13px]">
              <strong>{counts[key]}</strong> {label}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
