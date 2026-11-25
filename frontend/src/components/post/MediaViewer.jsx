import { Button } from '@/components/ui/Button'
import { IconChevronLeft, IconChevronRight, IconPlay } from '@/components/ui/icons'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { MediaStage, MediaThumb } from './Media'

const duration = (sec) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '')
const arrow = 'absolute top-1/2 size-11 -translate-y-1/2 rounded-full border-0 bg-white/90 text-ink hover:bg-white hover:text-ink'

/** Post photos and videos: one large item, arrows (and ←/→ keys), counter and a thumbnail strip (PostDetail.dc.html). */
export function MediaViewer({ media }) {
  const [index, setIndex] = useState(0)
  if (!media?.length) return null
  const many = media.length > 1
  const go = (step) => setIndex((i) => (i + step + media.length) % media.length)
  const current = media[index]

  return (
    <section
      aria-label="Photos and videos"
      className="border-y border-sand-soft bg-media"
      onKeyDown={(event) => {
        if (!many || event.target.tagName === 'VIDEO') return
        if (event.key === 'ArrowLeft') go(-1)
        if (event.key === 'ArrowRight') go(1)
      }}
    >
      <MediaStage item={current} data-testid="media-stage">
        {many && (
          <>
            <span aria-live="polite" className="absolute right-3 top-3 rounded-full bg-black/50 px-[9px] py-[3px] text-xs text-white">{index + 1} / {media.length}</span>
            <Button variant="light" iconOnly aria-label="Previous photo or video" onClick={() => go(-1)} className={cn(arrow, 'left-3')}>
              <IconChevronLeft aria-hidden="true" className="size-[18px]" strokeWidth={2} />
            </Button>
            <Button variant="light" iconOnly aria-label="Next photo or video" onClick={() => go(1)} className={cn(arrow, 'right-3')}>
              <IconChevronRight aria-hidden="true" className="size-[18px]" strokeWidth={2} />
            </Button>
          </>
        )}
      </MediaStage>
      {many && (
        <div role="group" aria-label="All photos and videos" className="grid grid-cols-6 gap-2 bg-white p-2.5">
          {media.map((item, i) => {
            const isVideo = item.type === 'video'
            return (
              <Button variant="bare"
                key={item.url + i}
                aria-pressed={i === index}
                onClick={() => setIndex(i)}
                className={cn(
                  'relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-[6px] border-2 p-0',
                  i === index ? 'border-roast' : 'border-sand hover:border-caramel',
                  isVideo ? 'bg-espresso-2' : 'bg-photo',
                )}
              >
                {/* Name = this text + the visible duration, so speech users can say what they see. */}
                <span className="sr-only">{`Show ${isVideo ? 'video' : 'photo'}: ${item.alt ?? i + 1}`}</span>
                <MediaThumb item={item} />
                {isVideo && (
                  <>
                    <span aria-hidden="true" className="relative grid size-7 place-items-center rounded-full bg-white/92 text-ink">
                      <IconPlay className="size-[13px] fill-current" strokeWidth={0} />
                    </span>
                    {item.durationSec && <span className="absolute bottom-1 right-1 rounded-[4px] bg-black/55 px-[5px] py-px text-[10px] text-white">{duration(item.durationSec)}</span>}
                  </>
                )}
              </Button>
            )
          })}
        </div>
      )}
    </section>
  )
}
