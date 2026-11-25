import { IconHeart, IconMessage, IconRefresh } from '@/components/ui/icons'
import { useState } from 'react'
import { Avatar, RoleBadge } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useComments, useMoreReplies } from '@/hooks/usePosts'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'

function Bubble({ comment, small = false }) {
  return (
    <div className={cn('inline-block max-w-full rounded-[4px_14px_14px_14px] bg-foam', small ? 'px-[13px] py-[9px]' : 'px-3.5 py-2.5')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn('font-semibold', small ? 'text-[13px]' : 'text-[13.5px]')}>{comment.author.name}</span>
        <RoleBadge person={comment.author} />
      </div>
      <p className={cn('mb-0 whitespace-pre-line leading-[1.6] text-ink', small ? 'mt-[3px] text-[13.5px]' : 'mt-1 text-sm')}>{comment.body}</p>
    </div>
  )
}

function Comment({ comment, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen)
  const more = useMoreReplies(comment._id, comment.repliesNextCursor, open && Boolean(comment.repliesNextCursor))
  const replies = [...comment.replies, ...(more.data?.pages.flatMap((p) => p.items) ?? [])]
  const n = comment.replyCount

  return (
    <li>
      <div className="flex gap-2.5">
        <Avatar person={comment.author} className="size-9 text-xs" />
        <div className="min-w-0 flex-1">
          <Bubble comment={comment} />
          <div className="ml-1 mt-1.5 flex flex-wrap items-center gap-3.5 text-xs text-ink-3">
            <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}</time>
            {comment.reactionCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <IconHeart aria-hidden="true" className="size-3 fill-danger-strong text-danger-strong" strokeWidth={0} />
                <span><span className="sr-only">Reactions: </span>{comment.reactionCount}</span>
              </span>
            )}
            {n > 0 && (
              <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="cursor-pointer border-0 bg-transparent px-0 py-1 text-[12.5px] font-semibold text-roast">
                {open ? 'Hide replies' : `View ${n} ${n === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>
          {open && n > 0 && (
            <ol className="m-0 mt-3 flex list-none flex-col gap-3 border-l-2 border-sand-soft py-0 pl-3.5 pr-0">
              {replies.map((reply) => (
                <li key={reply._id} className="flex gap-2.5">
                  <Avatar person={reply.author} className="size-[30px] text-[11px]" />
                  <div className="min-w-0 flex-1">
                    <Bubble comment={reply} small />
                    <time dateTime={reply.createdAt} className="ml-1 mt-[5px] block text-xs text-ink-3">{timeAgo(reply.createdAt)}</time>
                  </div>
                </li>
              ))}
              {(more.hasNextPage || (comment.repliesNextCursor && more.isPending)) && (
                <li>
                  <button
                    type="button"
                    disabled={more.isFetching}
                    onClick={() => more.fetchNextPage()}
                    className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-roast"
                  >
                    {more.isFetching ? 'Loading replies…' : 'View more replies'}
                  </button>
                </li>
              )}
            </ol>
          )}
        </div>
      </div>
    </li>
  )
}

/** Read-only comments with replies, oldest first, "Load more comments" (PostDetail.dc.html). */
export function CommentThread({ postId, total }) {
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useComments(postId)
  const comments = data?.pages.flatMap((p) => p.items) ?? []
  const shown = comments.reduce((sum, c) => sum + 1 + c.replyCount, 0)

  return (
    <section aria-labelledby="comments-title" className="rounded-card border border-sand bg-white px-5 pb-5 pt-[18px]">
      <h2 id="comments-title" className="m-0 text-base font-semibold">
        Comments <span className="font-normal text-ink-3">· {total}</span>
      </h2>
      {isPending && (
        <div className="mt-4 flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2.5"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-14 flex-1 rounded-[4px_14px_14px_14px]" /></div>
          ))}
        </div>
      )}
      {isError && (
        <EmptyState tone="error" icon={IconRefresh} title="We couldn't load the comments" className="mt-4 py-8" action={<Button variant="outline" onClick={() => refetch()}>Try again</Button>} />
      )}
      {data && !comments.length && <EmptyState icon={IconMessage} title="No comments yet" className="mt-4 py-8" />}
      {comments.length > 0 && (
        <>
          <ol className="m-0 mt-4 flex list-none flex-col gap-[18px] p-0">
            {comments.map((comment, i) => <Comment key={comment._id} comment={comment} defaultOpen={i === 0} />)}
          </ol>
          <div className="mt-5 flex flex-col items-center gap-1.5">
            {hasNextPage && (
              <Button variant="outline" pending={isFetchingNextPage} onClick={() => fetchNextPage()} className="px-5 font-medium">Load more comments</Button>
            )}
            <span className="text-[12.5px] text-ink-3">Showing {shown} of {total} comments</span>
          </div>
        </>
      )}
    </section>
  )
}
