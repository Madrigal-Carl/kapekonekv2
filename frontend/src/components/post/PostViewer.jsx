import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconChevronLeft, IconChevronRight, IconFileQuestion, IconPlay, IconRefresh, IconX } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { usePost, useRecordView } from '@/hooks/usePosts'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { CommentBox, HubComments } from './HubComments'
import { MediaThumb } from './Media'
import { countedViews } from './countedViews'
import { CountsRow, PostHeader, ReactBar } from './PostCard'

const roundClose = 'grid size-9 place-items-center rounded-full border-0 bg-foam p-0 text-ink-2 hover:bg-sand-soft'
const textDialog = cn(
  'fixed left-1/2 top-12 flex h-[calc(100vh-96px)] max-h-[820px] w-[640px] max-w-[calc(100%-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[10px] border-0 shadow-[0_30px_60px_-24px_rgba(43,26,18,0.55)]',
  'max-[720px]:inset-0 max-[720px]:h-dvh max-[720px]:max-h-none max-[720px]:w-full max-[720px]:max-w-none max-[720px]:translate-x-0 max-[720px]:rounded-none',
)
const kindOf = (item) => (item.type === 'video' ? 'video' : 'photo')

/** Author, caption, tags, counts, React / Comment and the full thread; the comment box is pinned at the bottom. */
function Panel({ post, onTag, box }) {
  return (
    <>
      <PostHeader post={post} headingId="pv-title" className="shrink-0 border-b border-sand-soft px-[18px] py-4" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mx-[18px] mb-0 mt-3.5 whitespace-pre-line text-[14.5px] leading-[1.65] wrap-anywhere">{post.body}</p>
        {post.tags.length > 0 && (
          <p className="mx-[18px] mb-0 mt-2 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Button variant="bare" key={tag} onClick={() => onTag(tag)} className="h-auto border-0 bg-transparent p-0 text-[13.5px] font-semibold text-roast">#{tag}</Button>
            ))}
          </p>
        )}
        <CountsRow post={post} className="mt-3" />
        <ReactBar post={post} onComment={() => box.current?.focus()} className="border-b" />
        <HubComments postId={post._id} total={post.commentCount} />
      </div>
      <CommentBox postId={post._id} ref={box} />
    </>
  )
}

/** The dark stage: the current photo or video, whole (contain), "2 / 5", previous / next, thumbnails and the close button. */
function Stage({ media, index, onIndex, onClose, closeRef }) {
  const item = media[index]
  const n = media.length
  const nav = 'absolute top-[calc(50%-52px)] grid size-12 place-items-center rounded-full border-0 bg-white/92 p-0 text-ink hover:bg-white max-[720px]:size-10'
  return (
    <div className="relative min-w-0 flex-1 px-[88px] pb-[120px] pt-16 max-[720px]:flex-[0_0_56vh] max-[720px]:px-2.5 max-[720px]:pb-[78px] max-[720px]:pt-[52px]">
      {n > 1 && <span aria-live="polite" className="absolute left-1/2 top-[22px] -translate-x-1/2 text-[13px] font-medium text-white/80">{index + 1} / {n}</span>}
      <Button ref={closeRef} variant="bare" aria-label="Close post" onClick={onClose} className="absolute right-3.5 top-3 z-[1] grid size-10 place-items-center rounded-full border-0 bg-white/14 p-0 text-white hover:bg-white/24">
        <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
      </Button>
      <div className="flex size-full items-center justify-center">
        {item.type === 'video' ? (
          // Keyed so switching items stops playback.
          <video key={item.url} src={item.url} poster={item.posterUrl} controls playsInline preload="metadata" aria-label={item.alt || `Video ${index + 1} of ${n}`} className="max-h-full max-w-full rounded object-contain" />
        ) : (
          <img key={item.url} src={imageUrl(item.url, 1200)} alt={item.alt || `Photo ${index + 1} of ${n}`} className="max-h-full max-w-full rounded object-contain" />
        )}
      </div>
      {index > 0 && (
        <Button variant="bare" aria-label="Previous" onClick={() => onIndex(index - 1)} className={cn(nav, 'left-5')}>
          <IconChevronLeft aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
        </Button>
      )}
      {index < n - 1 && (
        <Button variant="bare" aria-label="Next" onClick={() => onIndex(index + 1)} className={cn(nav, 'right-5')}>
          <IconChevronRight aria-hidden="true" className="size-[22px]" strokeWidth={2.2} />
        </Button>
      )}
      {n > 1 && (
        <div role="group" aria-label="All photos and videos" className="absolute bottom-6 left-1/2 flex max-w-[calc(100%-40px)] -translate-x-1/2 gap-2 overflow-x-auto p-0.5">
          {media.map((m, i) => (
            <Button
              variant="bare"
              key={m.url + i}
              aria-label={`Show ${kindOf(m)} ${i + 1}`}
              aria-current={i === index || undefined}
              onClick={() => onIndex(i)}
              className={cn('relative size-[60px] shrink-0 overflow-hidden rounded-[6px] border-2 bg-photo p-0 max-[720px]:size-11', i === index ? 'border-white' : 'border-transparent opacity-55 hover:opacity-80')}
            >
              <MediaThumb item={m} />
              {m.type === 'video' && (
                <span aria-hidden="true" className="absolute bottom-[3px] right-[3px] grid size-4 place-items-center rounded-full bg-white/92 text-ink">
                  <IconPlay className="size-2 fill-current" strokeWidth={0} />
                </span>
              )}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Hub post viewer (HubPostView / HubPostText / HubMobileView): a full-screen dialog with the panel on the left and the dark
 * media stage on the right, or a centered 640px dialog for text-only posts. Phones: stage on top (56%), panel below.
 * ← / → move through the media. Esc closes; the Modal returns focus to what opened it.
 * @param {{ id: string, initial?: object, index: number, focusComment?: boolean, onIndex: (i: number) => void, onClose: () => void, onTag: (tag: string) => void }} props
 */
export function PostViewer({ id, initial, index, focusComment, onIndex, onClose, onTag }) {
  const { data: post, isError, error, refetch } = usePost(id, initial)
  const { mutate: recordView } = useRecordView()
  const box = useRef(null)
  const closeRef = useRef(null)
  const media = post?.media ?? []
  const at = Math.min(Math.max(0, index), Math.max(0, media.length - 1))

  useEffect(() => {
    if (!post || countedViews.has(id)) return
    countedViews.add(id)
    recordView(id)
  }, [post, id, recordView])

  useEffect(() => {
    if (media.length < 2) return undefined
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, video, [role="group"][aria-label="Pick a reaction"]')) return
      if (e.key === 'ArrowLeft' && at > 0) onIndex(at - 1)
      if (e.key === 'ArrowRight' && at < media.length - 1) onIndex(at + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [media.length, at, onIndex])

  if (!post) {
    const missing = [403, 404, 422].includes(error?.response?.status)
    return (
      <Modal open onClose={onClose} labelledBy="pv-title" className={cn(textDialog, 'h-auto')}>
        <div className="relative shrink-0 border-b border-sand-soft px-[60px] py-3.5 text-center">
          <h2 id="pv-title" className="text-base font-semibold">Post</h2>
          <Button variant="bare" aria-label="Close post" onClick={onClose} className={cn(roundClose, 'absolute right-3 top-1/2 -translate-y-1/2')}>
            <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Button>
        </div>
        {!isError ? (
          <div className="grid place-items-center p-12"><Spinner className="size-6 text-roast" /></div>
        ) : missing ? (
          <EmptyState icon={IconFileQuestion} title="We couldn't find that post" className="border-0">It may have been deleted or removed.</EmptyState>
        ) : (
          <EmptyState tone="error" icon={IconRefresh} title="We couldn't load this post" className="border-0" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>} />
        )}
      </Modal>
    )
  }

  const panel = <Panel post={post} onTag={onTag} box={box} />
  if (!media.length) {
    return (
      <Modal open onClose={onClose} labelledBy="pv-title" initialFocus={focusComment ? box : closeRef} className={textDialog}>
        <div className="relative shrink-0 border-b border-sand-soft px-[60px] py-3.5 text-center">
          <span className="text-base font-semibold">{post.author.name.split(' ')[0]}’s post</span>
          <Button ref={closeRef} variant="bare" aria-label="Close post" onClick={onClose} className={cn(roundClose, 'absolute right-3 top-1/2 -translate-y-1/2')}>
            <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2.2} />
          </Button>
        </div>
        {panel}
      </Modal>
    )
  }
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="pv-title"
      initialFocus={focusComment ? box : closeRef}
      className="fixed inset-0 flex max-w-none rounded-none border-0 bg-media-deep shadow-none max-[720px]:flex-col-reverse max-[720px]:overflow-y-auto"
    >
      <section aria-label="Post details and comments" className="flex min-h-0 w-[400px] shrink-0 flex-col bg-white max-[720px]:w-full max-[720px]:flex-[1_0_auto]">
        {panel}
      </section>
      <Stage media={media} index={at} onIndex={onIndex} onClose={onClose} closeRef={closeRef} />
    </Modal>
  )
}
