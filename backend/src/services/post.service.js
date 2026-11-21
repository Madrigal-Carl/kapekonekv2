import {
  findCommentById, findPublishedPost, listLatestPublished, listReplies, listTopLevelComments,
} from '../repositories/post.repository.js';
import { AppError } from '../utils/AppError.js';
import { authorCard } from '../utils/authorCard.js';

const REPLY_PREVIEW = 2;
const notFound = () => new AppError(404, "We couldn't find that post.");

const presentPost = (post) => ({ ...post, author: authorCard(post.author) });
const presentComment = (c) => ({ _id: c._id, body: c.body, createdAt: c.createdAt, reactionCount: c.reactionCount, replyCount: c.replyCount, author: authorCard(c.author) });

/** @param {number} limit */
export const latestPosts = async (limit) => (await listLatestPublished(limit)).map(presentPost);

/** A published post, else 404. */
export async function getPost(id) {
  const post = await findPublishedPost(id);
  if (!post) throw notFound();
  return presentPost(post);
}

/**
 * Oldest-first page of top-level comments, each with its first replies and a cursor for the rest.
 * @param {string} postId
 * @param {{ cursor?: string, limit: number }} page
 */
export async function listComments(postId, page) {
  await getPost(postId);
  const { items, meta } = await listTopLevelComments(postId, page);
  const comments = await Promise.all(items.map(async (comment) => {
    const replies = await listReplies(comment._id, { limit: REPLY_PREVIEW });
    return { ...presentComment(comment), replies: replies.items.map(presentComment), repliesNextCursor: replies.meta.nextCursor };
  }));
  return { items: comments, meta };
}

/** Next page of a comment's replies. */
export async function listCommentReplies(commentId, page) {
  const comment = await findCommentById(commentId);
  if (!comment || comment.parent) throw new AppError(404, "We couldn't find that comment.");
  await getPost(comment.post);
  const { items, meta } = await listReplies(commentId, page);
  return { items: items.map(presentComment), meta };
}
