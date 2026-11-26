import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as posts from '@/services/post.service'

export const postKeys = {
  all: ['posts'],
  top: () => ['posts', 'top'],
  feed: (tag) => ['posts', 'feed', tag ?? 'all'],
  tags: () => ['posts', 'tags'],
  detail: (id) => ['posts', id],
  comments: (id) => ['posts', id, 'comments'],
  replies: (commentId) => ['comments', commentId, 'replies'],
}

export const useTopPosts = () => useQuery({ queryKey: postKeys.top(), queryFn: posts.topPosts })

/** One post; a 403 (not in the top 3, for guests and buyers) or 404 isn't retried. */
export const usePost = (id) =>
  useQuery({ queryKey: postKeys.detail(id), queryFn: () => posts.getPost(id), enabled: Boolean(id), retry: (n, error) => ![403, 404].includes(error?.response?.status) && n < 2 })

const pages = (fetchPage) => ({
  queryFn: ({ pageParam }) => fetchPage(pageParam),
  initialPageParam: undefined,
  getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
})

export const useComments = (postId, enabled = true) =>
  useInfiniteQuery({ queryKey: postKeys.comments(postId), ...pages((cursor) => posts.listComments(postId, { cursor, limit: 3 })), enabled })

/** The rest of a comment's replies, starting after the preview the comment came with. */
export const useMoreReplies = (commentId, startCursor, enabled) =>
  useInfiniteQuery({
    queryKey: [...postKeys.replies(commentId), startCursor],
    ...pages((cursor) => posts.listReplies(commentId, { cursor: cursor ?? startCursor, limit: 10 })),
    enabled,
  })

/** The Hub feed, newest first, optionally one tag. */
export const useFeed = (tag) => useInfiniteQuery({ queryKey: postKeys.feed(tag), ...pages((cursor) => posts.listFeed({ cursor, limit: 10, tag })) })

export const useTagCounts = () => useQuery({ queryKey: postKeys.tags(), queryFn: posts.tagCounts })

/** A post mutation that refreshes every post list, count and thread (posts are few; one key covers them). */
function usePostMutation(mutationFn) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: postKeys.all }), queryClient.invalidateQueries({ queryKey: ['comments'] })]),
  })
}

export const useCreatePost = () => usePostMutation(posts.createPost)
export const useUpdatePost = () => usePostMutation(posts.updatePost)
export const useDeletePost = () => usePostMutation(posts.deletePost)
export const useRemovePost = () => usePostMutation(posts.removePost)
export const useSetReaction = () => usePostMutation(posts.setReaction)
export const useAddComment = () => usePostMutation(posts.addComment)
export const useEditComment = () => usePostMutation(posts.editComment)
export const useDeleteComment = () => usePostMutation(posts.deleteComment)
export const useRemoveComment = () => usePostMutation(posts.removeComment)
/** Counting a view changes nothing on screen, so nothing is refetched. */
export const useRecordView = () => useMutation({ mutationFn: posts.recordView })
