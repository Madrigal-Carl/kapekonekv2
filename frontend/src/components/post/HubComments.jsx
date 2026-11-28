import { useId, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { IconRefresh, IconSend } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useCan } from '@/hooks/useCan'
import { useMe } from '@/hooks/useMe'
import { useAddComment, useComments, useDeleteComment, useEditComment, useMoreReplies, useRemoveComment, useSetReaction } from '@/hooks/usePosts'
import { errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { timeAgo } from '@/lib/date'
import { COMMENT_MAX, commentBodyRule } from '@/schemas/rules'
import { LengthHint } from './LengthHint'
import { useMentions } from '@/hooks/useMentions'
import { MentionList, MentionNote, MentionText } from './Mentions'

const metaButton = 'h-auto border-0 bg-transparent p-0 text-xs font-semibold text-ink-2 hover:text-ink'
const pill = 'min-w-0 flex-1 rounded-full border border-sand-strong bg-white px-3.5 py-1.5 focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20'
const onError = (error) => toast.error(errorMessage(error))

/** One-line input with a submit button: a new comment, a reply or an edit. Enter submits. */
function LineInput({ label, placeholder, initial = '', initialMentions, submitLabel, onSubmit, onCancel, pending, className, autoFocus }) {
  const [text, setText] = useState(initial)
  const hintId = useId()
  const input = useRef(null)
  const mention = useMentions(text, setText, input, initialMentions)
  const tooLong = text.trim().length > COMMENT_MAX
  const submit = () => {
    const parsed = commentBodyRule.safeParse(text)
    if (!parsed.success) return toast.error(parsed.error.issues[0].message)
    return onSubmit(parsed.data, () => setText(''), mention.ids(parsed.data))
  }
  return (
    <div className={cn('flex flex-col gap-1', className)}>
    <div className="flex items-center gap-2">
      <input
        ref={input}
        aria-label={label}
        placeholder={placeholder}
        value={text}
        aria-invalid={tooLong}
        aria-describedby={hintId}
        autoFocus={autoFocus}
        {...mention.inputProps(`${hintId}-mentions`)}
        onKeyDown={(e) => {
          if (mention.onKeyDown(e)) return
          if (e.key === 'Enter' && !tooLong) submit()
          if (e.key === 'Escape' && onCancel) onCancel()
        }}
        className={cn(pill, 'min-h-[38px] text-[13px] aria-invalid:border-logout')}
      />
      {onCancel && <Button variant="link" onClick={onCancel} className="h-auto text-[13px]">Cancel</Button>}
      {submitLabel && (
        <Button onClick={submit} loading={pending} disabled={!text.trim() || tooLong} className="h-[38px] rounded-full px-3.5 text-[13px]">{submitLabel}</Button>
      )}
    </div>
    <LengthHint id={hintId} value={text} max={COMMENT_MAX} />
    <MentionList id={`${hintId}-mentions`} mention={mention} />
    <MentionNote mention={mention} />
    </div>
  )
}

/** A comment or reply: bubble, then When · Like · Reply · Edit · Delete (own) or Remove (Kaluppa). */
function CommentItem({ comment, postId, small = false, onReply, onAsk }) {
  const me = useMe()
  const canModerate = useCan('posts.moderate')
  const [editing, setEditing] = useState(false)
  const react = useSetReaction()
  const edit = useEditComment()
  const mine = comment.author._id === me._id

  return (
    <div className={cn('flex gap-2.5', small && 'ml-[42px]')}>
      <Avatar person={comment.author} className={small ? 'size-7 text-[10px]' : 'size-8 text-[11px]'} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <LineInput
            label="Edit your comment"
            initial={comment.body}
            initialMentions={comment.mentions}
            submitLabel="Save"
            autoFocus
            pending={edit.isPending}
            onCancel={() => setEditing(false)}
            onSubmit={(body, _clear, mentions) => edit.mutate({ id: comment._id, body, mentions }, { onSuccess: () => setEditing(false), onError })}
          />
        ) : (
          <div className="inline-block max-w-full rounded-xl bg-foam px-3 py-2">
            <span className="block text-[13px] font-semibold">
              {comment.author.name} <span className="text-[11.5px] font-medium text-ink-3">{comment.author.roleLabel}</span>
            </span>
            <span className="block whitespace-pre-line text-[13.5px] leading-[1.5] wrap-anywhere"><MentionText text={comment.body} mentions={comment.mentions} /></span>
          </div>
        )}
        <span className="flex flex-wrap items-center gap-3 px-3 pt-[3px] text-xs text-ink-3">
          <time dateTime={comment.createdAt}>{timeAgo(comment.createdAt)}{comment.editedAt && ' · Edited'}</time>
          <Button
            variant="bare"
            aria-pressed={comment.liked}
            onClick={() => react.mutate({ target: 'comments', id: comment._id, type: comment.liked ? null : 'like' }, { onError })}
            className={cn(metaButton, comment.liked && 'text-roast hover:text-roast')}
          >
            Like{comment.reactionCount > 0 && ` · ${comment.reactionCount}`}
          </Button>
          {onReply && <Button variant="bare" onClick={onReply} className={metaButton}>Reply</Button>}
          {mine && !editing && (
            <>
              <Button variant="bare" onClick={() => setEditing(true)} className={metaButton}>Edit</Button>
              <Button variant="bare" onClick={() => onAsk({ kind: 'delete', comment })} className={cn(metaButton, 'text-logout hover:text-logout')}>Delete</Button>
            </>
          )}
          {!mine && canModerate && (
            <Button variant="bare" onClick={() => onAsk({ kind: 'remove', comment, postId })} className={cn(metaButton, 'text-logout hover:text-logout')}>Remove</Button>
          )}
        </span>
      </div>
    </div>
  )
}

function Thread({ comment, postId, replying, onReplyToggle, onAsk }) {
  const add = useAddComment()
  const more = useMoreReplies(comment._id, comment.repliesNextCursor, Boolean(comment.repliesNextCursor))
  const replies = [...comment.replies, ...(more.data?.pages.flatMap((p) => p.items) ?? [])]
  return (
    <div className="flex flex-col gap-2">
      <CommentItem comment={comment} postId={postId} onReply={onReplyToggle} onAsk={onAsk} />
      {replies.map((reply) => <CommentItem key={reply._id} comment={reply} postId={postId} small onAsk={onAsk} />)}
      {more.hasNextPage && (
        <Button variant="link" onClick={() => more.fetchNextPage()} disabled={more.isFetching} className="ml-[42px] h-auto self-start text-[12.5px]">
          {more.isFetching ? 'Loading replies…' : 'View more replies'}
        </Button>
      )}
      {replying && (
        <LineInput
          className="ml-[42px]"
          label="Write a reply"
          placeholder={`Reply to ${comment.author.name}…`}
          submitLabel="Reply"
          autoFocus
          pending={add.isPending}
          onSubmit={(body, clear, mentions) => add.mutate({ postId, body, parentId: comment._id, mentions }, { onSuccess: () => { clear(); onReplyToggle() }, onError })}
        />
      )}
    </div>
  )
}

/**
 * The comment box pinned under the post viewer's panel (HubPostView.dc.html). Enter sends; Shift+Enter starts a new line.
 * @param {{ postId: string, ref?: React.Ref<HTMLTextAreaElement> }} props
 */
export function CommentBox({ postId, ref }) {
  const me = useMe()
  const id = useId()
  const add = useAddComment()
  const [text, setText] = useState('')
  const own = useRef(null)
  const input = ref ?? own
  const mention = useMentions(text, setText, input)
  const tooLong = text.trim().length > COMMENT_MAX
  const send = () => {
    const parsed = commentBodyRule.safeParse(text)
    if (!parsed.success || add.isPending) return
    add.mutate({ postId, body: parsed.data, mentions: mention.ids(parsed.data) }, { onSuccess: () => setText(''), onError })
  }
  return (
    <div className="shrink-0 border-t border-sand-soft bg-white px-[18px] pb-4 pt-3">
      <div className="flex items-end gap-2">
        <Avatar person={me} className="size-8 text-[11px]" />
        <label htmlFor={id} className="sr-only">Write a comment</label>
        <textarea
          ref={input}
          id={id}
          rows={1}
          value={text}
          aria-invalid={tooLong}
          aria-describedby={`${id}-len`}
          {...mention.inputProps(`${id}-mentions`)}
          onKeyDown={(e) => {
            if (mention.onKeyDown(e)) return
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={`Comment as ${me.name}…`}
          className="min-h-10 min-w-0 flex-1 resize-none rounded-[5px] border border-sand-strong bg-white px-3 py-[9px] text-[13.5px] focus:border-roast focus:outline-none focus:ring-[3px] focus:ring-roast/20 aria-invalid:border-logout"
        />
        <Button iconOnly aria-label="Send comment" onClick={send} disabled={!text.trim() || tooLong} loading={add.isPending} className="size-10 shrink-0 rounded-[5px]">
          <IconSend aria-hidden="true" className="size-[17px]" strokeWidth={2} />
        </Button>
      </div>
      <LengthHint id={`${id}-len`} value={text} max={COMMENT_MAX} />
      <MentionList id={`${id}-mentions`} mention={mention} className="mt-1.5" />
      <MentionNote mention={mention} className="mt-1" />
    </div>
  )
}

/**
 * The full thread in the post viewer (HubPostView.dc.html): comments with one level of replies, Like, Reply, the author's
 * Edit / Delete, Kaluppa's Remove with a reason and "Load more comments". The comment box is `CommentBox`, pinned below.
 * @param {{ postId: string, total: number }} props
 */
export function HubComments({ postId, total }) {
  const { data, isPending, isError, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useComments(postId)
  const del = useDeleteComment()
  const remove = useRemoveComment()
  const [replyTo, setReplyTo] = useState(null)
  const [ask, setAsk] = useState(null)
  const comments = data?.pages.flatMap((p) => p.items) ?? []
  const shown = comments.reduce((sum, c) => sum + 1 + c.replyCount, 0)
  const close = () => setAsk(null)

  return (
    <div className="flex flex-col gap-3 px-[18px] pb-[18px] pt-3.5">
      {isPending && [1, 2].map((i) => <div key={i} className="flex gap-2.5"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-12 flex-1 rounded-xl" /></div>)}
      {isError && (
        <p className="m-0 flex items-center gap-2 text-[13px] text-ink-2">
          We couldn't load the comments.
          <Button variant="link" leftIcon={<IconRefresh aria-hidden="true" className="size-3.5" />} onClick={() => refetch()} className="h-auto text-[13px]">Try again</Button>
        </p>
      )}
      {data && !comments.length && <p className="m-0 py-[18px] text-center text-[13px] text-ink-3">No comments yet. Be the first to comment.</p>}
      {comments.map((comment) => (
        <Thread
          key={comment._id}
          comment={comment}
          postId={postId}
          replying={replyTo === comment._id}
          onReplyToggle={() => setReplyTo((id) => (id === comment._id ? null : comment._id))}
          onAsk={setAsk}
        />
      ))}
      {hasNextPage && (
        <Button variant="link" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="h-auto self-start text-[12.5px]">
          {isFetchingNextPage ? 'Loading comments…' : `Load more comments (${shown} of ${total})`}
        </Button>
      )}
      <ConfirmModal
        open={ask?.kind === 'delete'}
        variant="delete"
        title="Delete your comment?"
        confirmLabel="Delete comment"
        pending={del.isPending}
        onClose={close}
        onConfirm={() => del.mutate(ask.comment._id, { onSuccess: close, onError })}
      >
        Its replies are deleted with it. This can’t be undone.
      </ConfirmModal>
      <ConfirmModal
        open={ask?.kind === 'remove'}
        variant="remove_post"
        title="Remove this comment?"
        confirmLabel="Remove comment"
        reasonPlaceholder="e.g. Selling outside KapeKonek isn’t allowed in the Hub"
        pending={remove.isPending}
        onClose={close}
        onConfirm={(reason) => remove.mutate({ id: ask.comment._id, reason }, { onSuccess: close, onError })}
      >
        It leaves the Hub with its replies. The author gets a notification with your reason.
      </ConfirmModal>
    </div>
  )
}
