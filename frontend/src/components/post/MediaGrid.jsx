import { Button } from '@/components/ui/Button'
import { IconPlay } from '@/components/ui/icons'
import { imageUrl } from '@/lib/image'

// PHASE-2-SPEC §3.10 / Hub.dc.html: a fixed 16:10 frame, cropped with cover, so a tall or wide upload never changes the card's height.
// 1 item: the full frame; 2: two columns; 3: one big tile plus two small; 4+: 2×2 with "+N" on the last tile.
const LAYOUTS = {
  1: { grid: 'grid-cols-1 grid-rows-1', tiles: [''] },
  2: { grid: 'grid-cols-2 grid-rows-1', tiles: ['', ''] },
  3: { grid: 'grid-cols-[2fr_1fr] grid-rows-2', tiles: ['row-span-2', '', ''] },
  4: { grid: 'grid-cols-2 grid-rows-2', tiles: ['', '', '', ''] },
}

/**
 * The feed's media grid; a tile opens the viewer at that item.
 * @param {{ media: Array<{ type: string, url: string, posterUrl?: string, alt?: string }>, onOpen: (index: number) => void }} props
 */
export function MediaGrid({ media, onOpen }) {
  if (!media?.length) return null
  const shown = media.slice(0, 4)
  const { grid, tiles } = LAYOUTS[shown.length]
  const more = media.length - 4

  return (
    <div data-testid="media-grid" className={`mt-3 grid aspect-[16/10] gap-[3px] bg-media ${grid}`}>
      {shown.map((item, i) => {
        const isVideo = item.type === 'video'
        const src = isVideo ? item.posterUrl : item.url
        return (
          <Button
            variant="bare"
            key={item.url + i}
            aria-label={`Open ${isVideo ? 'video' : 'photo'} ${i + 1} of ${media.length}${i === 3 && more > 0 ? `, +${more} more` : ''}`}
            onClick={() => onOpen(i)}
            className={`relative grid min-h-0 place-items-center overflow-hidden border-0 p-0 ${isVideo ? 'bg-espresso-2' : 'bg-photo'} ${tiles[i]}`}
          >
            {src && <img src={imageUrl(src, i === 0 ? 680 : 340)} alt={item.alt ?? ''} loading="lazy" className="absolute inset-0 size-full object-cover" />}
            {isVideo && (
              <span aria-hidden="true" className="relative grid size-[52px] place-items-center rounded-full bg-white/92 text-ink">
                <IconPlay className="size-5 fill-current" strokeWidth={0} />
              </span>
            )}
            {i === 3 && more > 0 && (
              <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-media/55 text-[26px] font-semibold text-white">+{more}</span>
            )}
          </Button>
        )
      })}
    </div>
  )
}
