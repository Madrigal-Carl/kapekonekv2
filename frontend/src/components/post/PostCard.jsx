import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconMessage, IconMore, IconStar, IconThumbsUp } from '@/components/ui/icons'
import { useCan } from '@/hooks/useCan'
import { useRecordView, useSetReaction } from '@/hooks/usePosts'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'
import { useMe } from '@/hooks/useMe'
import { HubComments } from './HubComments'
import { MediaGrid } from './MediaGrid'
import { PostComposer } from './PostComposer'
import { REACTIONS } from './reactions'

const ROLE_BADGE = { farmer: 'bg-tone-green-bg text-tone-green-ink', group_manager: 'bg-tone-blue-bg text-tone-blue-ink', kaluppa: 'bg-espresso text-crema' }
const REACT_TEXT = { like: 'text-roast', love: 'text-danger-strong', celebrate: 'text-caramel-ink' }
const plural = (n, word) => `${n.toLocaleString('en-PH')} ${word}${n === 1 ? '' : 's'}`
// Posts counted this session; the server keeps one view per person per day anyway.
const counted = new Set()

/** Esc or a click outside the popover's wrapper closes it; focus moves to its first button. */
function usePopover(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    ref.current?.querySelector('[data-pop] button')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => !ref.current?.contains(e.target) && onClose()
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])
  return ref
}

/** Feed posts stop at 6 lines with "See more"; `clipped` is measured, so it follows the card's width. */
function PostBody({ body, full }) {
  const ref = useRef(null)
  const [expanded, setExpanded] = useState(full)
  const [clipped, setClipped] = useState(false)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node || expanded) return undefined
    const measure = () => setClipped(node.scrollHeight > node.clientHeight + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [body, expanded])
  return (
    <div className="mx-[18px] mt-3">
      <p ref={ref} className={cn('m-0 whitespace-pre-line text-[14.5px] leading-[1.65] wrap-anywhere', !expanded && 'line-clamp-6')}>{body}</p>
      {!expanded && clipped && (
        <Button variant="bare" onClick={() => setExpanded(true)} className="border-0 bg-transparent p-0 text-[14px] font-semibold text-ink-2 hover:underline">See more</Button>
      )}
    </div>
  )
}

/** Seen when half the card is on screen (PostView: signed-in, once a day). */
function useCountView(id) {
  const ref = useRef(null)
  const { mutate } = useRecordView()
  useEffect(() => {
    const node = ref.current
    if (!node || counted.has(id)) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || counted.has(id)) return
      counted.add(id)
      mutate(id)
      observer.disconnect()
    }, { threshold: 0.5 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, mutate])
  return ref
}

/**
 * A Hub post (Hub.dc.html): author, role and landing-page badges, the ⋯ menu (author: Edit / Delete; Kaluppa: Remove; others: Copy link),
 * text, #tags, the fixed media grid, reaction summary, React (picker) and Comment.
 * @param {{ post: object, onOpenMedia: (post: object, index: number) => void, onAsk: (ask: { kind: 'delete'|'remove', post: object }) => void,
 *   onTag?: (tag: string) => void, onToast: (message: string) => void, commentsOpen?: boolean }} props
 */
export function PostCard({ post, onOpenMedia, onAsk, onTag, onToast, commentsOpen = false }) {
  const me = useMe()
  const canModerate = useCan('posts.moderate')
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [open, setOpen] = useState(commentsOpen)
  const [editing, setEditing] = useState(false)
  const react = useSetReaction()
  const card = useCountView(post._id)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const closePicker = useCallback(() => setPickerOpen(false), [])
  const menuRef = usePopover(menuOpen, closeMenu)
  const pickerRef = usePopover(pickerOpen, closePicker)

  const mine = post.author._id === me._id
  const counts = post.reactionCounts
  const total = counts.like + counts.love + counts.celebrate
  const mineReaction = REACTIONS.find((r) => r.key === post.myReaction)
  const pick = (type) => {
    setPickerOpen(false)
    react.mutate({ target: 'posts', id: post._id, type: post.myReaction === type ? null : type }, { onError: (e) => toast.error(errorMessage(e)) })
  }
  const menu = mine
    ? [{ label: 'Edit post', run: () => setEditing(true) }, { label: 'Delete post', danger: true, run: () => onAsk({ kind: 'delete', post }) }]
    : canModerate
      ? [{ label: 'Remove post', danger: true, run: () => onAsk({ kind: 'remove', post }) }]
      : [{ label: 'Copy link', run: () => navigator.clipboard.writeText(`${window.location.origin}/dashboard/hub/posts/${post._id}`).then(() => onToast('Link copied.')) }]
  return (
    <article ref={card} aria-labelledby={`h-${post._id}`} className="rounded-[10px] border border-sand bg-white">
      <header className="flex items-start gap-3 px-[18px] pt-4">
        <Avatar person={post.author} className="size-[42px] text-[13px]" />
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span id={`h-${post._id}`} className="text-[14.5px] font-semibold">{post.author.name}</span>
            {post.author.roleLabel && <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', ROLE_BADGE[post.author.role])}>{post.author.roleLabel}</span>}
            {post.isTop && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tone-amber-bg px-2 py-px text-[11px] font-semibold text-tone-amber-ink">
                <IconStar aria-hidden="true" className="size-[11px] fill-current" strokeWidth={0} />On the landing page
              </span>
            )}
          </span>
          <span className="block text-xs text-ink-3">
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>{post.editedAt && ' · Edited'} · {post.viewCount ? plural(post.viewCount, 'view') : 'new'}
          </span>
        </div>
        <div ref={menuRef} className="relative">
          <Button
            variant="bare"
            aria-label="Post options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className={cn('grid size-9 place-items-center rounded-full border-0 text-ink-3', menuOpen ? 'bg-sand-soft' : 'bg-transparent hover:bg-highlight')}
          >
            <IconMore aria-hidden="true" className="size-[17px]" strokeWidth={2.4} />
          </Button>
          {menuOpen && (
            <div data-pop role="menu" className="absolute right-0 top-full z-10 w-[200px] rounded-lg border border-sand bg-white p-1 shadow-[0_14px_30px_-14px_rgba(43,26,18,0.45)]">
              {menu.map((item) => (
                <Button
                  variant="bare"
                  key={item.label}
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    item.run()
                  }}
                  className={cn('flex min-h-[38px] w-full items-center rounded-[5px] border-0 bg-transparent px-3 text-left text-[13px] hover:bg-cream focus-visible:bg-cream', item.danger ? 'text-logout' : 'text-ink')}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </header>

      {editing ? (
        <PostComposer post={post} onCancel={() => setEditing(false)} onDone={(message) => { setEditing(false); onToast(message) }} />
      ) : (
        <>
          <PostBody body={post.body} full={commentsOpen} />
          {post.tags.length > 0 && (
            <p className="mx-[18px] mb-0 mt-1.5 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <Button variant="bare" key={tag} onClick={() => onTag?.(tag)} className="border-0 bg-transparent p-0 text-[13.5px] font-semibold text-roast">#{tag}</Button>
              ))}
            </p>
          )}
          <MediaGrid media={post.media} onOpen={(i) => onOpenMedia(post, i)} />
        </>
      )}

      <div className="flex items-center justify-between gap-2.5 px-[18px] py-2.5 text-[12.5px] text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          {total > 0 && (
            <span aria-hidden="true" className="inline-flex">
              {REACTIONS.filter((r) => counts[r.key] > 0).map(({ key, icon: Icon, tile }, i) => (
                <span key={key} className={cn('grid size-5 place-items-center rounded-full border-2 border-white', tile, i > 0 && '-ml-[5px]')}>
                  <Icon className="size-2.5 fill-current" strokeWidth={0} />
                </span>
              ))}
            </span>
          )}
          {total > 0 ? plural(total, 'reaction') : 'No reactions yet'}
        </span>
        <span>{plural(post.commentCount, 'comment')}</span>
      </div>

      <div ref={pickerRef} className="relative flex gap-1 border-t border-sand-soft px-2.5 py-1">
        <Button
          variant="bare"
          aria-pressed={Boolean(post.myReaction)}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((o) => !o)}
          className={cn('inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[5px] border-0 bg-transparent text-[13.5px] font-semibold hover:bg-cream', mineReaction ? REACT_TEXT[mineReaction.key] : 'text-ink-2')}
        >
          {mineReaction ? <mineReaction.icon aria-hidden="true" className="size-[17px] fill-current" strokeWidth={1.8} /> : <IconThumbsUp aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />}
          {mineReaction?.label ?? 'React'}
        </Button>
        <Button
          variant="bare"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[5px] border-0 bg-transparent text-[13.5px] font-semibold text-ink-2 hover:bg-cream"
        >
          <IconMessage aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />Comment
        </Button>
        {pickerOpen && (
          <div data-pop role="group" aria-label="Pick a reaction" className="absolute bottom-[calc(100%-4px)] left-3.5 z-10 flex gap-1 rounded-full border border-sand bg-white p-1.5 shadow-[0_14px_30px_-14px_rgba(43,26,18,0.45)]">
            {REACTIONS.map(({ key, label, icon: Icon, tile }) => (
              <Button
                variant="bare"
                key={key}
                aria-label={label}
                aria-pressed={post.myReaction === key}
                onClick={() => pick(key)}
                className={cn('grid size-10 place-items-center rounded-full border-0 p-0', tile, post.myReaction === key && 'outline-2 outline-espresso')}
              >
                <Icon aria-hidden="true" className="size-[17px] fill-current" strokeWidth={0} />
              </Button>
            ))}
          </div>
        )}
      </div>

      {open && <HubComments postId={post._id} total={post.commentCount} />}
    </article>
  )
}
