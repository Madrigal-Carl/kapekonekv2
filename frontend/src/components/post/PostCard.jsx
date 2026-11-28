import { MentionText } from './Mentions'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconMessage, IconMore, IconStar, IconThumbsUp } from '@/components/ui/icons'
import { useCan } from '@/hooks/useCan'
import { useMe } from '@/hooks/useMe'
import { useRecordView, useSetReaction } from '@/hooks/usePosts'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'
import { countedViews } from './countedViews'
import { MediaGrid } from './MediaGrid'
import { REACTIONS } from './reactions'

const ROLE_BADGE = { farmer: 'bg-tone-green-bg text-tone-green-ink', group_manager: 'bg-tone-blue-bg text-tone-blue-ink', kaluppa: 'bg-espresso text-crema' }
const REACT_TEXT = { like: 'text-roast', love: 'text-danger-strong', celebrate: 'text-caramel-ink' }
const CUT = 240 // captions longer than this end in "See more" (PHASE-2-SPEC §3.10)
const textButton = 'h-auto border-0 bg-transparent p-0 text-left'
const plural = (n, word) => `${n.toLocaleString('en-PH')} ${word}${n === 1 ? '' : 's'}`

/** Esc or a click outside the popover's wrapper closes it; focus moves to its first button. */
function usePopover(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    ref.current?.querySelector('[data-pop] button')?.focus()
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // inside the viewer, Esc closes the picker, not the dialog
      onClose()
    }
    const onDown = (e) => !ref.current?.contains(e.target) && onClose()
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onClose])
  return ref
}

/** Seen when half the card is on screen (PostView: signed-in, once a day). */
function useCountView(id) {
  const ref = useRef(null)
  const { mutate } = useRecordView()
  useEffect(() => {
    const node = ref.current
    if (!node || countedViews.has(id)) return undefined
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || countedViews.has(id)) return
      countedViews.add(id)
      mutate(id)
      observer.disconnect()
    }, { threshold: 0.5 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [id, mutate])
  return ref
}

/**
 * Author with role and landing-page badges, then "time · N views" (a button that opens the post when `onMeta` is given).
 * @param {{ post: object, headingId: string, onMeta?: () => void, className?: string, children?: React.ReactNode }} props
 */
export function PostHeader({ post, headingId, onMeta, className, children }) {
  const meta = (
    <>
      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>{post.editedAt && ' · Edited'} · {post.viewCount ? plural(post.viewCount, 'view') : 'new'}
    </>
  )
  return (
    <header className={cn('flex items-start gap-3', className)}>
      <Avatar person={post.author} className="size-[42px] text-[13px]" />
      <div className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span id={headingId} className="text-[14.5px] font-semibold">{post.author.name}</span>
          {post.author.roleLabel && <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold', ROLE_BADGE[post.author.role])}>{post.author.roleLabel}</span>}
          {post.isTop && (
            <span className="inline-flex items-center gap-1 rounded-full bg-tone-amber-bg px-2 py-px text-[11px] font-semibold text-tone-amber-ink">
              <IconStar aria-hidden="true" className="size-[11px] fill-current" strokeWidth={0} />On the landing page
            </span>
          )}
        </span>
        {onMeta ? (
          <Button variant="bare" onClick={onMeta} className={cn(textButton, 'block text-xs font-normal text-ink-3 hover:underline')}>{meta}</Button>
        ) : (
          <span className="block text-xs text-ink-3">{meta}</span>
        )}
      </div>
      {children}
    </header>
  )
}

/** Stacked reaction icons and the count, then the comment count (a button that opens the post when `onComments` is given). */
export function CountsRow({ post, onComments, className }) {
  const counts = post.reactionCounts
  const total = counts.like + counts.love + counts.celebrate
  const comments = plural(post.commentCount, 'comment')
  return (
    <div className={cn('flex items-center justify-between gap-2.5 px-[18px] py-2.5 text-[12.5px] text-ink-3', className)}>
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
      {onComments ? <Button variant="bare" onClick={onComments} className={cn(textButton, 'text-[12.5px] font-normal text-ink-3 hover:underline')}>{comments}</Button> : <span>{comments}</span>}
    </div>
  )
}

/** React (with the like / love / celebrate picker) and Comment. */
export function ReactBar({ post, onComment, commentOpensDialog = false, className }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const closePicker = useCallback(() => setPickerOpen(false), [])
  const pickerRef = usePopover(pickerOpen, closePicker)
  const react = useSetReaction()
  const mine = REACTIONS.find((r) => r.key === post.myReaction)
  const pick = (type) => {
    setPickerOpen(false)
    react.mutate({ target: 'posts', id: post._id, type: post.myReaction === type ? null : type }, { onError: (e) => toast.error(errorMessage(e)) })
  }
  const action = 'inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[5px] border-0 bg-transparent text-[13.5px] font-semibold hover:bg-cream'
  return (
    <div ref={pickerRef} className={cn('relative flex gap-1 border-t border-sand-soft px-2.5 py-1', className)}>
      <Button variant="bare" aria-pressed={Boolean(post.myReaction)} aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)} className={cn(action, mine ? REACT_TEXT[mine.key] : 'text-ink-2')}>
        {mine ? <mine.icon aria-hidden="true" className="size-[17px] fill-current" strokeWidth={1.8} /> : <IconThumbsUp aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />}
        {mine?.label ?? 'React'}
      </Button>
      <Button variant="bare" aria-haspopup={commentOpensDialog ? 'dialog' : undefined} onClick={onComment} className={cn(action, 'text-ink-2')}>
        <IconMessage aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />Comment
      </Button>
      {pickerOpen && (
        <div data-pop role="group" aria-label="Pick a reaction" className="absolute bottom-[calc(100%-4px)] left-3.5 z-10 flex gap-1 rounded-full border border-sand bg-white p-1.5 shadow-[0_14px_30px_-14px_rgba(43,26,18,0.45)]">
          {REACTIONS.map(({ key, label, icon: Icon, tile }) => (
            <Button variant="bare" key={key} aria-label={label} aria-pressed={post.myReaction === key} onClick={() => pick(key)} className={cn('grid size-10 place-items-center rounded-full border-0 p-0', tile, post.myReaction === key && 'outline-2 outline-espresso')}>
              <Icon aria-hidden="true" className="size-[17px] fill-current" strokeWidth={0} />
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

/** One comment bubble with its time (the feed card's last-comment preview). */
function CommentPreview({ comment }) {
  return (
    <div className="flex gap-2.5">
      <Avatar person={comment.author} className="size-8 text-[11px]" />
      <div className="min-w-0">
        <div className="rounded-xl bg-foam px-3 py-2">
          <span className="block text-[13px] font-semibold">
            {comment.author.name} <span className="text-[11.5px] font-medium text-ink-3">{comment.author.roleLabel}</span>
          </span>
          <span className="block whitespace-pre-line text-[13.5px] leading-[1.5] wrap-anywhere"><MentionText text={comment.body} mentions={comment.mentions} /></span>
        </div>
        <time dateTime={comment.createdAt} className="block px-3 pt-[3px] text-xs text-ink-3">{timeAgo(comment.createdAt)}</time>
      </div>
    </div>
  )
}

/**
 * A Hub feed post (Hub.dc.html): header with the ⋯ menu (author: Edit / Delete; Kaluppa: Remove; others: Copy link), the caption
 * (cut at 240 characters with "See more"), #tags, the fixed media grid, counts, React / Comment, the last comment,
 * "View all N comments" and "Write a comment…". Everything that reads further opens the post viewer through `onOpen`.
 * @param {{ post: object, onOpen: (post: object, at?: { media?: number, comment?: boolean }) => void, onEdit: (post: object) => void,
 *   onAsk: (ask: { kind: 'delete'|'remove', post: object }) => void, onTag?: (tag: string) => void, onToast: (message: string) => void }} props
 */
export function PostCard({ post, onOpen, onEdit, onAsk, onTag, onToast }) {
  const me = useMe()
  const canModerate = useCan('posts.moderate')
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  const menuRef = usePopover(menuOpen, closeMenu)
  const card = useCountView(post._id)
  const open = (at) => onOpen(post, at)
  const cut = post.body.length > CUT
  const caption = cut ? post.body.slice(0, CUT - 20).replace(/\s+\S*$/, '') : post.body

  const menu = post.author._id === me._id
    ? [{ label: 'Edit post', run: () => onEdit(post) }, { label: 'Delete post', danger: true, run: () => onAsk({ kind: 'delete', post }) }]
    : canModerate
      ? [{ label: 'Remove post', danger: true, run: () => onAsk({ kind: 'remove', post }) }]
      : [{ label: 'Copy link', run: () => navigator.clipboard.writeText(`${window.location.origin}/dashboard/hub/posts/${post._id}`).then(() => onToast('Link copied.')) }]

  return (
    <article ref={card} aria-labelledby={`h-${post._id}`} className="rounded-[10px] border border-sand bg-white">
      <PostHeader post={post} headingId={`h-${post._id}`} onMeta={() => open()} className="px-[18px] pt-4">
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
      </PostHeader>

      <p className="mx-[18px] mb-0 mt-3 whitespace-pre-line text-[14.5px] leading-[1.65] wrap-anywhere">
        <MentionText text={caption} mentions={post.mentions} />
        {cut && (
          <>
            …{' '}
            <Button variant="bare" onClick={() => open()} className={cn(textButton, 'text-sm font-semibold text-ink hover:underline')}>See more</Button>
          </>
        )}
      </p>
      {post.tags.length > 0 && (
        <p className="mx-[18px] mb-0 mt-1.5 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Button variant="bare" key={tag} onClick={() => onTag?.(tag)} className={cn(textButton, 'text-[13.5px] font-semibold text-roast')}>#{tag}</Button>
          ))}
        </p>
      )}
      <MediaGrid media={post.media} onOpen={(i) => open({ media: i })} />
      <CountsRow post={post} onComments={() => open()} />
      <ReactBar post={post} onComment={() => open({ comment: true })} commentOpensDialog />

      <div className="flex flex-col gap-2.5 border-t border-sand-soft px-[18px] pb-3.5 pt-2.5">
        {post.commentCount > 1 && (
          <Button variant="bare" onClick={() => open()} className={cn(textButton, 'self-start text-[13px] font-semibold text-ink-2 hover:underline')}>
            View all {post.commentCount.toLocaleString('en-PH')} comments
          </Button>
        )}
        {post.lastComment && <CommentPreview comment={post.lastComment} />}
        <Button variant="bare" aria-haspopup="dialog" onClick={() => open({ comment: true })} className="flex items-center gap-2.5 border-0 bg-transparent p-0 text-left">
          <span aria-hidden="true"><Avatar person={me} className="size-8 text-[11px]" /></span>
          <span className="flex min-h-[38px] flex-1 items-center rounded-[5px] border border-sand-strong bg-cream px-3 text-[13.5px] font-normal text-ink-3">Write a comment…</span>
        </Button>
      </div>
    </article>
  )
}
