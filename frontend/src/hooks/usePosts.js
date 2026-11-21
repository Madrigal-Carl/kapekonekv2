import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import * as posts from '@/services/post.service'

export const postKeys = {
  all: ['posts'],
  latest: (limit) => ['posts', 'latest', limit],
  detail: (id) => ['posts', id],
  comments: (id) => ['posts', id, 'comments'],
  replies: (commentId) => ['comments', commentId, 'replies'],
}

export const useLatestPosts = (limit = 3) => useQuery({ queryKey: postKeys.latest(limit), queryFn: () => posts.latestPosts(limit) })

export const usePost = (id) => useQuery({ queryKey: postKeys.detail(id), queryFn: () => posts.getPost(id) })

const pages = (fetchPage) => ({
  queryFn: ({ pageParam }) => fetchPage(pageParam),
  initialPageParam: undefined,
  getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
})

export const useComments = (postId) =>
  useInfiniteQuery({ queryKey: postKeys.comments(postId), ...pages((cursor) => posts.listComments(postId, { cursor, limit: 3 })) })

/** The rest of a comment's replies, starting after the preview the comment came with. */
export const useMoreReplies = (commentId, startCursor, enabled) =>
  useInfiniteQuery({
    queryKey: [...postKeys.replies(commentId), startCursor],
    ...pages((cursor) => posts.listReplies(commentId, { cursor: cursor ?? startCursor, limit: 10 })),
    enabled,
  })
