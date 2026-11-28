import { cn } from '@/lib/cn'
import { imageUrl, squareUrl } from '@/lib/image'

// Every post photo or video renders in one of these fixed frames, so a portrait or panorama upload never changes a height (DESIGN §8.2).

/**
 * Fixed 16:10 frame for one post item. Viewer (default): dark stage up to 560px tall, whole item visible (`contain`), videos play.
 * `cover`: card frame that fills the 16:10 box, showing a video's poster.
 * @param {{ item: { type: string, url: string, posterUrl?: string, alt?: string }, cover?: boolean, className?: string, children?: import('react').ReactNode }} props
 */
export function MediaStage({ item, cover = false, className, children, ...rest }) {
  const fill = cn('absolute inset-0 size-full', cover ? 'object-cover' : 'object-contain')
  const isVideo = item.type === 'video'
  const src = isVideo ? item.posterUrl : item.url
  return (
    <div {...rest} className={cn('relative aspect-[16/10] w-full overflow-hidden', cover ? 'bg-photo' : 'max-h-[560px] bg-media', className)}>
      {isVideo && !cover ? (
        // Keyed so switching items stops playback.
        <video key={item.url} src={item.url} poster={item.posterUrl} controls preload="metadata" aria-label={item.alt} className={fill} />
      ) : (
        src && <img src={imageUrl(src, cover ? 400 : 800)} alt={item.alt ?? ''} loading={cover ? 'lazy' : undefined} className={fill} />
      )}
      {children}
    </div>
  )
}

/** Square, cropped thumbnail image for a post item (fills its square parent). */
export function MediaThumb({ item }) {
  const src = item.type === 'video' ? item.posterUrl : item.url
  return src ? <img src={squareUrl(src, 160)} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : null
}
