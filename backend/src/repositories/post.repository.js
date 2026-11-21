import { Post } from '../models/post.model.js';
import { PostComment } from '../models/postComment.model.js';
import { Reaction } from '../models/reaction.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const AUTHOR = 'firstName lastName roles avatar';
const VISIBLE = { isPublished: true, deletedAt: null };
const OLDEST_FIRST = { sortField: 'createdAt', direction: 'asc' };

/** Newest published, undeleted posts. */
export const listLatestPublished = (limit) =>
  Post.find(VISIBLE).sort({ createdAt: -1, _id: -1 }).limit(limit).populate('author', AUTHOR).lean();

/** A published, undeleted post. */
export const findPublishedPost = (id) => Post.findOne({ _id: id, ...VISIBLE }).populate('author', AUTHOR).lean();

/** A comment, for checking its post before listing replies. */
export const findCommentById = (id) => PostComment.findById(id, { post: 1, parent: 1 }).lean();

async function commentPage(filter, { cursor, limit }) {
  const docs = await PostComment.find({ ...filter, ...cursorFilter({ ...OLDEST_FIRST, cursor }) })
    .sort(cursorSort(OLDEST_FIRST))
    .limit(limit + 1)
    .populate('author', AUTHOR)
    .lean();
  return pageResult(docs, limit, OLDEST_FIRST.sortField);
}

/** Oldest-first page of a post's top-level comments. */
export const listTopLevelComments = (postId, page) => commentPage({ post: postId, parent: null }, page);

/** Oldest-first page of a comment's replies. */
export const listReplies = (commentId, page) => commentPage({ parent: commentId }, page);

/** Bulk inserts and counts for the posts seeder. */
export const insertPosts = (posts) => Post.insertMany(posts);
export const insertComments = (comments) => PostComment.insertMany(comments);
export const insertReactions = (reactions) => Reaction.insertMany(reactions);
export const countPosts = () => Post.countDocuments();
