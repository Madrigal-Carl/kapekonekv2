import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { MediaViewer } from '@/components/post/MediaViewer'
import { PostCard } from '@/components/post/PostCard'
import { PostComposer, TagChip } from '@/components/post/PostComposer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconCheck, IconFileQuestion, IconRefresh, IconX } from '@/components/ui/icons'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { useInfiniteSentinel } from '@/hooks/useInfiniteSentinel'
import { useDeletePost, useFeed, usePost, useRemovePost, useTagCounts, useTopPosts } from '@/hooks/usePosts'
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
    <aside className="sticky top-7 flex max-w-[340px] flex-[1_1_280px] flex-col gap-3.5 self-start max-[720px]:static max-[720px]:max-w-none">
      <section className={card}>
        <h2 className="m-0 text-[15px] font-semibold">Most viewed this month</h2>
        <p className="mt-0.5 text-xs leading-[1.5] text-ink-3">These 3 appear on the landing page for everyone. Views count signed-in people once a day.</p>
        <ol className="m-0 mt-3 flex list-none flex-col gap-2.5 p-0">
          {top.isPending && [1, 2, 3].map((i) => <li key={i}><Skeleton className="h-9 rounded-md" /></li>)}
          {top.data?.length === 0 && <li className="text-[13px] text-ink-3">No views yet this month.</li>}
          {top.data?.map((post, i) => (
            <li key={post._id} className="flex gap-2.5">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-crema text-xs font-bold text-roast">{i + 1}</span>
              <span className="text-[13px] leading-[1.45]">
                <Link to={`/dashboard/hub/posts/${post._id}`} className="font-semibold text-ink no-underline hover:underline">{firstSentence(post.body)}</Link>
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

/** Delete (author) and Remove with reason (Kaluppa) confirmations, and the media viewer. */
function usePostDialogs({ onToast, onGone }) {
  const [ask, setAsk] = useState(null)
  const [viewer, setViewer] = useState(null)
  const del = useDeletePost()
  const remove = useRemovePost()
  const close = () => setAsk(null)
  const done = (message) => () => {
    close()
    onToast(message)
    onGone?.()
  }
  const onError = (error) => toast.error(errorMessage(error))

  const dialogs = (
    <>
      <ConfirmModal open={ask?.kind === 'delete'} variant="delete" title="Delete your post?" confirmLabel="Delete post" pending={del.isPending} onClose={close}
        onConfirm={() => del.mutate(ask.post._id, { onSuccess: done('Your post was deleted.'), onError })}>
        It’s removed with its comments and reactions. This can’t be undone.
      </ConfirmModal>
      <ConfirmModal open={ask?.kind === 'remove'} variant="remove_post" title="Remove this post?" confirmLabel="Remove post" pending={remove.isPending} onClose={close}
        reasonPlaceholder="e.g. Selling outside KapeKonek isn’t allowed in the Hub"
        onConfirm={(reason) => remove.mutate({ id: ask.post._id, reason }, { onSuccess: done('Post removed. The author was notified.'), onError })}>
        It leaves the Hub. The author gets a notification with your reason.
      </ConfirmModal>
      <Modal open={Boolean(viewer)} onClose={() => setViewer(null)} labelledBy="viewer-title" className="max-w-[900px] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <h2 id="viewer-title" className="m-0 truncate text-sm font-semibold">{viewer && `Photos and videos · ${viewer.post.author.name}`}</h2>
          <Button variant="ghost" iconOnly size="sm" aria-label="Close" onClick={() => setViewer(null)} className="text-ink-2">
            <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} />
          </Button>
        </div>
        {viewer && <MediaViewer media={viewer.post.media} start={viewer.index} />}
      </Modal>
    </>
  )
  return { dialogs, onAsk: setAsk, onOpenMedia: (post, index) => setViewer({ post, index }) }
}

function Main({ children }) {
  return <main className="flex w-full flex-col gap-5 px-8 pb-14 pt-7 max-[960px]:px-4 max-[960px]:pb-10 max-[960px]:pt-5">{children}</main>
}

/** `/dashboard/hub` (Hub.dc.html): composer, tag filter, the feed with infinite scroll, and the aside. */
export function Hub() {
  const [params, setParams] = useSearchParams()
  const tag = POST_TAGS.includes(params.get('tag')) ? params.get('tag') : undefined
  const [toastText, setToastText] = useState('')
  const feed = useFeed(tag)
  const sentinel = useInfiniteSentinel(feed)
  const posts = feed.data?.pages.flatMap((p) => p.items) ?? []
  const { dialogs, onAsk, onOpenMedia } = usePostDialogs({ onToast: setToastText })
  const pickTag = (next) => setParams(next ? { tag: next } : {}, { replace: true })

  return (
    <Main>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <div>
            <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">Community</span>
            <h1 className="mt-1.5 text-[28px] font-medium tracking-[-0.02em]">Hub</h1>
            <p className="mt-1 text-sm text-ink-2">Tips, questions and news from farmers, Group Managers and Kaluppa.</p>
          </div>
          <PostComposer onDone={setToastText} />
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
          {posts.map((post) => <PostCard key={post._id} post={post} onOpenMedia={onOpenMedia} onAsk={onAsk} onTag={pickTag} onToast={setToastText} />)}
          <div ref={sentinel} />
          {feed.isFetchingNextPage && (
            <div className="flex items-center justify-center gap-2 p-2 text-[12.5px] text-ink-3"><Spinner className="size-3.5 text-roast" />Loading more posts</div>
          )}
        </div>
        <Aside />
      </div>
      {dialogs}
    </Main>
  )
}

/** `/dashboard/hub/posts/:id`: one post with its comments open (notification links land here). */
export function HubPost() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [toastText, setToastText] = useState('')
  const { data: post, isPending, isError, error, refetch } = usePost(id)
  const { dialogs, onAsk, onOpenMedia } = usePostDialogs({ onToast: setToastText, onGone: () => navigate('/dashboard/hub', { replace: true }) })
  const missing = [404, 422].includes(error?.response?.status)

  return (
    <Main>
      <div className="flex w-full flex-col gap-3.5">
        <Link to="/dashboard/hub" className="self-start text-[13.5px] font-semibold no-underline">← Back to Hub</Link>
        <Banner message={toastText} onClose={() => setToastText('')} />
        {isPending && <Skeleton className="h-[480px] rounded-[10px]" />}
        {isError && (missing ? (
          <EmptyState icon={IconFileQuestion} title="We couldn't find that post" className="bg-white" action={<Button as={Link} to="/dashboard/hub">Back to Hub</Button>}>It may have been deleted or removed.</EmptyState>
        ) : (
          <EmptyState tone="error" icon={IconRefresh} title="We couldn't load this post" className="bg-white" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>} />
        ))}
        {post && <PostCard post={post} onOpenMedia={onOpenMedia} onAsk={onAsk} onTag={(t) => navigate(`/dashboard/hub?tag=${t}`)} onToast={setToastText} commentsOpen />}
      </div>
      {dialogs}
    </Main>
  )
}

