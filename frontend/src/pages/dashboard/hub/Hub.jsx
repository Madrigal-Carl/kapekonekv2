import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { CreatePostModal } from '@/components/post/CreatePostModal'
import { PostCard } from '@/components/post/PostCard'
import { PostViewer } from '@/components/post/PostViewer'
import { TagChip } from '@/components/post/TagChip'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconCheck, IconHash, IconImage, IconRefresh, IconX } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { useInfiniteSentinel } from '@/hooks/useInfiniteSentinel'
import { useMe } from '@/hooks/useMe'
import { useDeletePost, useFeed, useRemovePost, useTagCounts, useTopPosts } from '@/hooks/usePosts'
import { errorMessage } from '@/lib/applyServerErrors'
import { POST_TAGS } from '@/schemas/rules'

const card = 'rounded-[10px] border border-sand bg-white px-[18px] py-4'
const firstSentence = (text) => {
  const line = text.split(/(?<=[.!?])\s|\n/)[0]
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line
}

/** Success banner under the filters (Hub.dc.html), dismissible. */
function Banner({ message, onClose }) {
  if (!message) return null
  return (
    <div role="status" className="flex items-center gap-2.5 rounded-lg border border-tone-green-line bg-tone-green-bg px-3.5 py-3 text-[13.5px] font-medium text-tone-green-ink">
      <IconCheck aria-hidden="true" className="size-[17px]" strokeWidth={2.4} />
      <span className="flex-1">{message}</span>
      <Button variant="bare" aria-label="Dismiss" onClick={onClose} className="grid size-8 place-items-center border-0 bg-transparent text-tone-green-ink">
        <IconX aria-hidden="true" className="size-[15px]" strokeWidth={2} />
      </Button>
    </div>
  )
}

/** The aside: this month's top 3 (the landing page's posts) and posts per tag. */
function Aside() {
  const top = useTopPosts()
  const tags = useTagCounts()
  return (
    <aside className="sticky top-[88px] flex flex-[0_0_340px] flex-col gap-3.5 self-start max-[960px]:hidden">
      <section className={card}>
        <h2 className="m-0 text-[15px] font-semibold">Most viewed this month</h2>
        <p className="mt-0.5 text-xs leading-[1.5] text-ink-3">These 3 appear on the landing page for everyone. Views count signed-in people once a day.</p>
        <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {top.isPending && [1, 2, 3].map((i) => <li key={i}><Skeleton className="h-9 rounded-md" /></li>)}
          {top.data?.length === 0 && <li className="text-[13px] text-ink-3">No views yet this month.</li>}
          {top.data?.map((post, i) => (
            <li key={post._id} className="flex gap-2.5">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-crema text-xs font-bold text-roast">{i + 1}</span>
              <span className="min-w-0 text-[13px] leading-[1.45] wrap-anywhere">
                <Link to={`/dashboard/hub/posts/${post._id}`} state={{ fromHub: true }} className="font-semibold text-ink no-underline hover:underline">{firstSentence(post.body)}</Link>
                <span className="block text-xs text-ink-3">{post.author.name} · {post.views.toLocaleString('en-PH')} views</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <section className={card}>
        <h2 className="m-0 text-[15px] font-semibold">Tags</h2>
        <ul className="m-0 mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {(tags.data ?? POST_TAGS.map((tag) => ({ tag, count: null }))).map(({ tag, count }) => (
            <li key={tag} className="flex justify-between text-[13px]">
              <span className="font-semibold text-roast">#{tag}</span>
              <span className="text-ink-3">{count === null ? '…' : `${count} ${count === 1 ? 'post' : 'posts'}`}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  )
}

/** "What’s on your mind, Rodel?" with Photo / video and Tags shortcuts; each opens the Create post modal (Hub.dc.html). */
function CreatePostTrigger({ onOpen }) {
  const me = useMe()
  const shortcut = 'inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[6px] border-0 bg-transparent text-[13.5px] font-semibold text-ink-2 hover:bg-cream'
  return (
    <section aria-label="Create a post" className="rounded-[10px] border border-sand bg-white px-4 pb-2 pt-3.5">
      <div className="flex items-center gap-3">
        <Avatar person={me} className="size-[42px] text-[13px]" />
        <Button variant="bare" aria-haspopup="dialog" onClick={() => onOpen('text')} className="min-h-11 flex-1 rounded-lg border border-sand-strong bg-cream px-4 text-left text-[14.5px] font-normal text-ink-3 hover:bg-foam">
          What’s on your mind, {me.firstName}?
        </Button>
      </div>
      <div className="mt-3 flex gap-1 border-t border-sand-soft pt-1.5">
        <Button variant="bare" aria-haspopup="dialog" onClick={() => onOpen('media')} className={shortcut}>
          <IconImage aria-hidden="true" className="size-5 text-success" strokeWidth={2} />Photo / video
        </Button>
        <Button variant="bare" aria-haspopup="dialog" onClick={() => onOpen('tags')} className={shortcut}>
          <IconHash aria-hidden="true" className="size-5 text-roast" strokeWidth={2} />Tags
        </Button>
      </div>
    </section>
  )
}

/**
 * `/dashboard/hub` (Hub.dc.html): the Create post trigger, tag filter, the feed with infinite scroll and the aside.
 * `/dashboard/hub/posts/:id?media=n` is the same page with the post viewer open over the feed, so links, notifications and the
 * back button work. Both routes share this element's key, so the feed (and the focus the viewer returns to) stays mounted.
 */
export function Hub() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const tag = POST_TAGS.includes(params.get('tag')) ? params.get('tag') : undefined
  const [toastText, setToastText] = useState('')
  const [compose, setCompose] = useState(null) // { start } or { post } while the modal is open
  const [ask, setAsk] = useState(null)
  const feed = useFeed(tag)
  const sentinel = useInfiniteSentinel(feed)
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? []
  const del = useDeletePost()
  const remove = useRemovePost()
  const hubUrl = (t) => (t ? `/dashboard/hub?tag=${t}` : '/dashboard/hub')
  const pickTag = (next) => setParams(next ? { tag: next } : {}, { replace: true })
  const viewerState = location.state

  const openPost = (post, { media, comment } = {}) => {
    const query = new URLSearchParams({ ...(tag && { tag }), ...(media && { media: String(media) }) }).toString()
    navigate(`/dashboard/hub/posts/${post._id}${query ? `?${query}` : ''}`, { state: { fromHub: true, comment, post } })
  }
  // Opened from the feed: back to it. From a link or a notification: the feed.
  const closePost = () => (viewerState?.fromHub ? navigate(-1) : navigate(hubUrl(tag)))
  const showMedia = useCallback(
    (i) =>
      setParams(
        (p) => {
          p.set('media', String(i))
          return p
        },
        { replace: true, state: viewerState },
      ),
    [setParams, viewerState],
  )
  const done = (message) => () => {
    setAsk(null)
    setToastText(message)
  }
  const onError = (error) => toast.error(errorMessage(error))

  return (
    <main className="flex w-full flex-col gap-5 px-8 pb-14 pt-7 max-[960px]:px-4 max-[960px]:pb-10 max-[960px]:pt-5">
      <div className="flex items-start gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div>
            <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Community</span>
            <h1 className="mt-1.5 text-[28px] font-medium tracking-[-0.02em]">Hub</h1>
            <p className="mt-1 text-sm text-ink-2">Tips, questions and news from farmers, Group Managers and Kaluppa.</p>
          </div>
          <CreatePostTrigger onOpen={(start) => setCompose({ start })} />
          <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-1.5">
            <TagChip size="md" tone="espresso" pressed={!tag} onClick={() => pickTag()}>All posts</TagChip>
            {POST_TAGS.map((t) => <TagChip key={t} tag={t} size="md" tone="espresso" pressed={tag === t} onClick={() => pickTag(t)} />)}
          </div>
          <Banner message={toastText} onClose={() => setToastText('')} />
          {feed.isPending && [1, 2].map((i) => <Skeleton key={i} className="h-[420px] rounded-[10px]" />)}
          {feed.isError && (
            <EmptyState tone="error" icon={IconRefresh} title="We couldn't load the Hub" className="bg-white" action={<Button variant="outline" onClick={() => feed.refetch()}>Try again</Button>} />
          )}
          {feed.data && !posts.length && (
            <p className="m-0 rounded-[10px] border border-sand bg-white p-8 text-center text-ink-3">
              {tag ? `No posts with #${tag} yet.` : 'No posts yet. Share the first update with the community.'}
            </p>
          )}
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onOpen={openPost} onEdit={(p) => setCompose({ post: p })} onAsk={setAsk} onTag={pickTag} onToast={setToastText} />
          ))}
          <div ref={sentinel} />
          {feed.isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 p-2 text-[12.5px] text-ink-3"><Spinner className="size-3.5 text-roast" />Loading more posts</div>
          )}
        </div>
        <Aside />
      </div>

      {compose && (
        <CreatePostModal
          post={compose.post}
          start={compose.start}
          onClose={() => setCompose(null)}
          onDone={(message) => {
            setCompose(null)
            setToastText(message)
          }}
        />
      )}
      {id && (
        <PostViewer
          key={id}
          id={id}
          initial={viewerState?.post?._id === id ? viewerState.post : undefined}
          index={Number(params.get('media')) || 0}
          focusComment={Boolean(viewerState?.comment)}
          onIndex={showMedia}
          onClose={closePost}
          onTag={(t) => navigate(hubUrl(t), { replace: true })}
        />
      )}
      <ConfirmModal open={ask?.kind === 'delete'} variant="delete" title="Delete your post?" confirmLabel="Delete post" pending={del.isPending} onClose={() => setAsk(null)}
        onConfirm={() => del.mutate(ask.post._id, { onSuccess: done('Your post was deleted.'), onError })}>
        It’s removed with its comments and reactions. This can’t be undone.
      </ConfirmModal>
      <ConfirmModal open={ask?.kind === 'remove'} variant="remove_post" title="Remove this post?" confirmLabel="Remove post" pending={remove.isPending} onClose={() => setAsk(null)}
        reasonPlaceholder="e.g. Selling outside KapeKonek isn’t allowed in the Hub"
        onConfirm={(reason) => remove.mutate({ id: ask.post._id, reason }, { onSuccess: done('Post removed. The author was notified.'), onError })}>
        It leaves the Hub. The author gets a notification with your reason.
      </ConfirmModal>
    </main>
  )
}
