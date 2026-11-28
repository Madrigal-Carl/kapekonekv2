import { Post } from '../models/post.model.js';
import { PostComment } from '../models/postComment.model.js';
import { PostView } from '../models/postView.model.js';
import { Reaction } from '../models/reaction.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

const AUTHOR = 'firstName lastName roles avatar';
const VISIBLE = { isPublished: true, deletedAt: null, removedAt: null };
const OLDEST_FIRST = { sortField: 'createdAt', direction: 'asc' };
const NEWEST_FIRST = { sortField: 'createdAt', direction: 'desc' };

/** A published post nobody deleted or removed. */
export const findPublishedPost = (id) => Post.findOne({ _id: id, ...VISIBLE }).populate('author', AUTHOR).lean();

/** Visible posts with these ids, in no particular order. */
export const findPublishedByIds = (ids) => Post.find({ _id: { $in: ids }, ...VISIBLE }).populate('author', AUTHOR).lean();

/**
 * Newest-first page of the Hub feed, optionally one tag.
 * @param {{ tag?: string, cursor?: string, limit: number }} page
 */
export async function listFeed({ tag, cursor, limit }) {
  const docs = await Post.find({ ...VISIBLE, ...(tag ? { tags: tag } : {}), ...cursorFilter({ ...NEWEST_FIRST, cursor }) })
    .sort(cursorSort(NEWEST_FIRST))
    .limit(limit + 1)
    .populate('author', AUTHOR)
    .lean();
  return pageResult(docs, limit, NEWEST_FIRST.sortField);
}

/** Visible posts per tag: `[{ _id: tag, count }]`. */
export const countPostsByTag = () =>
  Post.aggregate([{ $match: VISIBLE }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }]);

export const createPost = (fields) => Post.create(fields);

/** Update a visible post; returns the post after the change, or null. */
export const updatePublishedPost = (id, set) =>
  Post.findOneAndUpdate({ _id: id, ...VISIBLE }, { $set: set }, { returnDocument: 'after' }).populate('author', AUTHOR).lean();

/** Bump a post's counters (`{ commentCount: 1 }`, `{ 'reactionCounts.like': -1 }`). */
export const incrementPost = (id, inc) => Post.updateOne({ _id: id }, { $inc: inc });

// Comments

/** A comment with its post id and author, for permission checks. */
export const findCommentById = (id) => PostComment.findById(id).lean();

async function commentPage(filter, { cursor, limit }) {
  const docs = await PostComment.find({ ...filter, ...cursorFilter({ ...OLDEST_FIRST, cursor }) })
    .sort(cursorSort(OLDEST_FIRST))
    .limit(limit + 1)
    .populate('author', AUTHOR)
    .lean();
  return pageResult(docs, limit, OLDEST_FIRST.sortField);
}

/** Oldest-first page of a post's top-level comments. */
/** Each post's newest top-level comment, with its author (the feed card's preview). */
export async function latestTopLevelComments(postIds) {
  const rows = await PostComment.aggregate([
    { $match: { post: { $in: postIds }, parent: null } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$post', id: { $first: '$_id' } } },
  ]);
  return PostComment.find({ _id: { $in: rows.map((r) => r.id) } }).populate('author', AUTHOR).lean();
}

export const listTopLevelComments = (postId, page) => commentPage({ post: postId, parent: null }, page);

/** Oldest-first page of a comment's replies. */
export const listReplies = (commentId, page) => commentPage({ parent: commentId }, page);

export const createComment = async (fields) => (await PostComment.create(fields)).populate('author', AUTHOR);

export const updateCommentBody = (id, body, mentions) =>
  PostComment.findByIdAndUpdate(id, { $set: { body, mentions, editedAt: new Date() } }, { returnDocument: 'after' }).populate('author', AUTHOR).lean();

export const incrementComment = (id, inc) => PostComment.updateOne({ _id: id }, { $inc: inc });

/** Delete a comment, its replies and their reactions; returns how many comments went. */
export async function deleteCommentTree(id) {
  const ids = [id, ...(await PostComment.find({ parent: id }, { _id: 1 }).lean()).map((c) => c._id)];
  await Reaction.deleteMany({ targetType: 'comment', target: { $in: ids } });
  return (await PostComment.deleteMany({ _id: { $in: ids } })).deletedCount;
}

// Reactions

export const findReaction = (targetType, target, user) => Reaction.findOne({ targetType, target, user }).lean();

/** Set the user's reaction; returns the one it replaced, or null. */
export const setReaction = (targetType, target, user, type) =>
  Reaction.findOneAndUpdate({ targetType, target, user }, { $set: { type } }, { upsert: true, returnDocument: 'before' }).lean();

/** Remove the user's reaction; returns it, or null when there was none. */
export const removeReaction = (targetType, target, user) => Reaction.findOneAndDelete({ targetType, target, user }).lean();

/** `{ targetId: type }` of the user's reactions on these targets. */
export async function reactionsOf(user, targetType, targets) {
  const rows = await Reaction.find({ user, targetType, target: { $in: targets } }, { target: 1, type: 1 }).lean();
  return Object.fromEntries(rows.map((r) => [String(r.target), r.type]));
}

// Views

/** Record one view per post, user and day; true when this is the first today. */
export async function addView(post, user, day) {
  const result = await PostView.updateOne({ post, user, day }, { $setOnInsert: { post, user, day } }, { upsert: true });
  return result.upsertedCount === 1;
}

/**
 * The most-viewed visible posts since `sinceDay` (YYYYMMDD), ties broken by the newest post.
 * @returns {Promise<Array<{ _id: unknown, views: number }>>}
 */
export const topViewedSince = (sinceDay, limit) =>
  PostView.aggregate([
    { $match: { day: { $gte: sinceDay } } },
    { $group: { _id: '$post', views: { $sum: 1 } } },
    { $lookup: { from: Post.collection.name, localField: '_id', foreignField: '_id', as: 'post', pipeline: [{ $match: VISIBLE }, { $project: { createdAt: 1 } }] } },
    { $unwind: '$post' },
    { $sort: { views: -1, 'post.createdAt': -1, _id: -1 } },
    { $limit: limit },
    { $project: { views: 1 } },
  ]);

/** Bulk inserts and counts for the posts seeder. */
export const insertPosts = (posts) => Post.insertMany(posts);
export const insertComments = (comments) => PostComment.insertMany(comments);
export const insertReactions = (reactions) => Reaction.insertMany(reactions);
export const insertViews = (views) => PostView.insertMany(views);
export const countPosts = () => Post.countDocuments();
