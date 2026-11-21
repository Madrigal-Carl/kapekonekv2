import { Eye, FileQuestion, RotateCw } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { CommentThread } from '@/components/post/CommentThread'
import { MediaViewer } from '@/components/post/MediaViewer'
import { ReactionSummary } from '@/components/post/ReactionSummary'
import { Avatar, RoleBadge } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { usePost } from '@/hooks/usePosts'
import { formatDateTime, timeAgo } from '@/lib/date'

/** `/posts/:id` — read-only post for guests and buyers (PostDetail.dc.html). */
export function PostDetail() {
  const { id } = useParams()
  const { data: post, isPending, isError, error, refetch } = usePost(id)

  return (
    <div className="bg-foam">
      <div className="mx-auto max-w-[800px] px-4 pt-7 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-ink-3">
          <Link to="/" className="text-ink-3 no-underline">Home</Link>
          <span aria-hidden="true" className="mx-2">/</span>
          <span aria-current="page" className="text-ink">Post</span>
        </nav>
      </div>

      <main className="mx-auto flex max-w-[800px] flex-col gap-5 px-4 pb-20 pt-4 sm:px-6">
        {isPending && <Skeleton className="h-[520px] rounded-card" />}
        {isError && (
          error?.response?.status === 404 || error?.response?.status === 422 ? (
            <EmptyState icon={FileQuestion} title="We couldn't find that post" action={<Button to="/">Back to home</Button>} className="bg-white">It may have been removed.</EmptyState>
          ) : (
            <EmptyState tone="error" icon={RotateCw} title="We couldn't load this post" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>} className="bg-white" />
          )
        )}
        {post && (
          <>
            <article aria-labelledby="post-author" className="overflow-hidden rounded-card border border-sand bg-white">
              <header className="flex items-center gap-3 px-5 py-[18px]">
                <Avatar person={post.author} className="size-12 text-[15px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span id="post-author" className="text-[15.5px] font-semibold">{post.author.name}</span>
                    <RoleBadge person={post.author} className="px-2 py-0.5 text-[10.5px]" />
                  </div>
                  <span className="text-[12.5px] text-ink-3">
                    <time dateTime={post.createdAt}>{formatDateTime(post.createdAt)}</time> · {timeAgo(post.createdAt)}
                  </span>
                </div>
              </header>
              <div className="px-5 pb-[18px] text-[15px] leading-[1.7] text-ink">
                {post.body.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className={i ? 'mb-0 mt-3 whitespace-pre-line' : 'm-0 whitespace-pre-line'}>{para}</p>
                ))}
              </div>
              <MediaViewer media={post.media} />
              <ReactionSummary counts={post.reactionCounts} commentCount={post.commentCount} />
              <div role="note" className="mx-5 mb-[18px] flex items-center gap-2.5 rounded-[6px] border border-notice-line bg-crema px-3.5 py-3 text-[13px] text-ink-2">
                <Eye aria-hidden="true" className="size-[17px] shrink-0 text-roast" strokeWidth={1.9} />
                You're viewing this post. Reacting and commenting are open to KapeKonek farmers, Group Managers and Kaluppa.
              </div>
            </article>
            <CommentThread postId={post._id} total={post.commentCount} />
          </>
        )}
        <Link to="/" className="self-start text-[13.5px] font-semibold no-underline">← Back to home</Link>
      </main>
    </div>
  )
}
