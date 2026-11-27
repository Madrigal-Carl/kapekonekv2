import { getValkey } from '../config/valkey.js';
import * as repo from '../repositories/post.repository.js';
import { POST_TAGS } from '../schemas/rules.js';
import { AppError } from '../utils/AppError.js';
import { authorCard } from '../utils/authorCard.js';
import { manilaDateKey } from '../utils/manilaDate.js';
import * as audit from './audit.service.js';
import { notifyUsers } from './notification.service.js';
import { userCan } from './permission.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

const REPLY_PREVIEW = 2;
const TOP_KEY = 'posts:top3';
const TOP_COUNT = 3;
const TOP_DAYS = 30;
const DAY_MS = 86_400_000;

const notFound = () => new AppError(404, "We couldn't find that post.");
const commentNotFound = () => new AppError(404, "We couldn't find that comment.");
const notYours = (what) => new AppError(403, `Only the author can change this ${what}.`);
const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });
const same = (a, b) => String(a) === String(b);
const postLink = (id) => `/dashboard/hub/posts/${id}`;
const excerpt = (text, n = 60) => (text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text);

/** Hub members (farmers, Group Managers, Kaluppa) see every post; guests and buyers only the landing page's top 3. */
const isHubMember = async (user) => Boolean(user) && userCan(user, 'dashboard.view');

function presentPost(post, { full = false, myReaction, top } = {}) {
  return {
    ...post,
    removedBy: undefined,
    removalReason: undefined,
    author: authorCard(post.author, { full }),
    ...(myReaction !== undefined && { myReaction }),
    ...(top && { isTop: top.has(String(post._id)) }),
  };
}
const presentComment = (c, { full = false, liked } = {}) => ({
  _id: c._id, body: c.body, createdAt: c.createdAt, editedAt: c.editedAt ?? null, parent: c.parent ?? null,
  reactionCount: c.reactionCount, replyCount: c.replyCount, author: authorCard(c.author, { full }),
  ...(liked && { liked: Boolean(liked[String(c._id)]) }),
});

// Top 3 (landing page): the most-viewed posts of the last 30 days, ranked hourly by the `posts:top3` job.

/**
 * Rank the top 3 from the last 30 Manila days of views and cache them in Valkey. Idempotent.
 * @param {Date} [now]
 * @returns {Promise<Array<{ id: string, views: number }>>}
 */
export async function refreshTopPosts(now = new Date()) {
  const since = manilaDateKey(new Date(now.getTime() - (TOP_DAYS - 1) * DAY_MS));
  const top = (await repo.topViewedSince(since, TOP_COUNT)).map((r) => ({ id: String(r._id), views: r.views }));
  // Kept past the hourly run so a late job never empties the landing page.
  await getValkey().set(TOP_KEY, JSON.stringify(top), 'EX', 3 * 3600).catch((error) => console.error(`[posts:top3] cache write failed: ${error.message}`));
  return top;
}

/** The cached top 3, ranked now when the cache is empty or Valkey is down. */
async function topEntries() {
  try {
    const cached = await getValkey().get(TOP_KEY);
    if (cached) return JSON.parse(cached);
  } catch (error) {
    console.error(`[posts:top3] cache read failed: ${error.message}`);
  }
  return refreshTopPosts();
}
const topIds = async () => new Set((await topEntries()).map((t) => t.id));

/** `GET /posts/top`: the 3 posts on the landing page (full names, as Main.dc.html), each with its views over the last 30 days. */
export async function topPosts() {
  const entries = await topEntries();
  const posts = new Map((await repo.findPublishedByIds(entries.map((t) => t.id))).map((p) => [String(p._id), p]));
  return entries.filter((t) => posts.has(t.id)).map((t) => ({ ...presentPost(posts.get(t.id), { full: true }), views: t.views }));
}

/** Re-rank after a top post leaves the Hub, so the landing page doesn't keep a gap for an hour. */
async function refreshTopIfListed(postId) {
  if ((await topIds()).has(String(postId))) await refreshTopPosts();
}

// Reading

/**
 * A post the user may open: Hub members any visible post, guests and buyers only the top 3 (403 otherwise).
 * @param {string} id
 * @param {object} [user] signed-in user, if any
 */
export async function getPost(id, user) {
  const post = await repo.findPublishedPost(id);
  if (!post) throw notFound();
  const member = await isHubMember(user);
  const top = await topIds();
  if (!member && !top.has(String(post._id))) {
    throw new AppError(403, 'This post is in the KapeKonek Hub, for farmers, Group Managers and Kaluppa.', { code: 'FORBIDDEN' });
  }
  if (!member) return presentPost(post);
  const mine = await repo.reactionsOf(user._id, 'post', [post._id]);
  return presentPost(post, { full: true, myReaction: mine[String(post._id)] ?? null, top });
}

/**
 * Oldest-first page of top-level comments, each with its first replies and a cursor for the rest.
 * @param {string} postId
 * @param {{ cursor?: string, limit: number }} page
 * @param {object} [user]
 */
export async function listComments(postId, page, user) {
  await getPost(postId, user);
  const member = await isHubMember(user);
  const { items, meta } = await repo.listTopLevelComments(postId, page);
  const withReplies = await Promise.all(items.map(async (comment) => ({ comment, replies: await repo.listReplies(comment._id, { limit: REPLY_PREVIEW }) })));
  const all = withReplies.flatMap(({ comment, replies }) => [comment, ...replies.items]);
  const liked = member ? await repo.reactionsOf(user._id, 'comment', all.map((c) => c._id)) : undefined;
  const opts = { full: member, liked };
  return {
    items: withReplies.map(({ comment, replies }) => ({
      ...presentComment(comment, opts), replies: replies.items.map((r) => presentComment(r, opts)), repliesNextCursor: replies.meta.nextCursor,
    })),
    meta,
  };
}

/** Next page of a comment's replies. */
export async function listCommentReplies(commentId, page, user) {
  const comment = await repo.findCommentById(commentId);
  if (!comment || comment.parent) throw commentNotFound();
  await getPost(comment.post, user);
  const member = await isHubMember(user);
  const { items, meta } = await repo.listReplies(commentId, page);
  const liked = member ? await repo.reactionsOf(user._id, 'comment', items.map((c) => c._id)) : undefined;
  return { items: items.map((c) => presentComment(c, { full: member, liked })), meta };
}

/**
 * `GET /hub/posts`: newest first, optionally one tag, with the user’s reaction, the landing-page badge and the newest comment.
 * @param {object} user
 * @param {{ tag?: string, cursor?: string, limit: number }} query
 */
export async function listFeed(user, query) {
  const { items, meta } = await repo.listFeed(query);
  const ids = items.map((p) => p._id);
  const [mine, top, latest] = await Promise.all([repo.reactionsOf(user._id, 'post', ids), topIds(), repo.latestTopLevelComments(ids)]);
  const last = new Map(latest.map((c) => [String(c.post), presentComment(c, { full: true })]));
  return {
    items: items.map((p) => ({ ...presentPost(p, { full: true, myReaction: mine[String(p._id)] ?? null, top }), lastComment: last.get(String(p._id)) ?? null })),
    meta,
  };
}

/** Posts per tag, every tag listed (the Hub's Tags card). */
export async function tagCounts() {
  const counts = Object.fromEntries((await repo.countPostsByTag()).map((r) => [r._id, r.count]));
  return POST_TAGS.map((tag) => ({ tag, count: counts[tag] ?? 0 }));
}

// Writing posts

/** A video's first frame as a jpg (Cloudinary derives it from the URL). */
const posterFor = (url) => url.replace('/video/upload/', '/video/upload/so_0/').replace(/\.[a-z0-9]+$/i, '.jpg');

/** Media from the author's own `post_media` folder, re-checked on Cloudinary; items already on the post stay as they are. */
async function checkedMedia(user, media, existing = []) {
  const kept = new Map(existing.map((m) => [m.url, m]));
  const out = [];
  for (const item of media) {
    if (kept.has(item.url)) {
      out.push(kept.get(item.url));
      continue;
    }
    if (!item.publicId || !isOwnUpload(user, 'post_media', item)) throw fieldError('media', 'Upload these photos or videos again.');
    const { kind, width, height, durationSec } = await assertUploadAllowed('post_media', item.publicId, 'media');
    out.push({ type: kind, url: item.url, publicId: item.publicId, width, height, durationSec, alt: item.alt, ...(kind === 'video' && { posterUrl: posterFor(item.url) }) });
  }
  return out;
}

const AUDITED = ['body', 'tags', 'mediaCount'];
const auditView = (p) => ({ body: p.body, tags: p.tags, mediaCount: p.media?.length ?? 0 });
const entity = (p) => ({ type: 'post', id: p._id, label: excerpt(p.body, 40) });

/** `POST /hub/posts` (`posts.create`). */
export async function createPost(user, { body, tags, media }) {
  const post = await repo.createPost({ author: user._id, body, tags, media: await checkedMedia(user, media) });
  await audit.record({ actor: user, area: 'hub', action: 'create', entity: entity(post), after: auditView(post), fields: AUDITED });
  return getPost(post._id, user);
}

async function ownPost(user, id) {
  const post = await repo.findPublishedPost(id);
  if (!post) throw notFound();
  if (!same(post.author?._id, user._id)) throw notYours('post');
  return post;
}

/** `PATCH /hub/posts/:id`: the author changes the text, tags or media. */
export async function updatePost(user, id, { body, tags, media }) {
  const before = await ownPost(user, id);
  const after = await repo.updatePublishedPost(id, { body, tags, media: await checkedMedia(user, media, before.media), editedAt: new Date() });
  if (!after) throw notFound();
  await audit.record({ actor: user, area: 'hub', action: 'update', entity: entity(after), before: auditView(before), after: auditView(after), fields: AUDITED });
  return getPost(id, user);
}

/** `DELETE /hub/posts/:id`: the author deletes it, with its comments and reactions out of sight. */
export async function deletePost(user, id) {
  const post = await ownPost(user, id);
  await repo.updatePublishedPost(id, { deletedAt: new Date() });
  await audit.record({ actor: user, area: 'hub', action: 'delete', entity: entity(post) });
  await refreshTopIfListed(id);
}

/** `POST /hub/posts/:id/remove` (`posts.moderate`): Kaluppa removes it with a reason and the author is told why. */
export async function removePost(user, id, { reason }) {
  const post = await repo.updatePublishedPost(id, { removedAt: new Date(), removedBy: user._id, removalReason: reason });
  if (!post) throw notFound();
  await audit.record({ actor: user, area: 'hub', action: 'remove', entity: entity(post), after: { removalReason: reason }, fields: ['removalReason'] });
  if (!same(post.author?._id, user._id)) {
    await notifyUsers([post.author._id], { type: 'post_removed', title: 'Kaluppa removed your post', body: `“${excerpt(post.body)}” · ${reason}`, link: '/dashboard/hub', data: { postId: post._id } });
  }
  await refreshTopIfListed(id);
}

/** `POST /hub/posts/:id/view`: once per signed-in person per Manila day. Guests never reach this (401). */
export async function recordView(user, id, now = new Date()) {
  const post = await getPost(id, user);
  const counted = await repo.addView(post._id, user._id, manilaDateKey(now));
  if (counted) await repo.incrementPost(post._id, { viewCount: 1 });
  return { counted };
}

// Reactions (`posts.react`) and comments (`posts.comment`)

async function notifyAuthor(authorId, actor, title, postId, body = '') {
  if (!authorId || same(authorId, actor._id)) return;
  await notifyUsers([authorId], { type: 'post_activity', title, body, link: postLink(postId), data: { postId } });
}
const who = (user) => authorCard(user, { full: true }).name;

/** The target of a reaction or comment: a visible post, or a comment on one. */
async function reactionTarget(targetType, id) {
  if (targetType === 'post') {
    const post = await repo.findPublishedPost(id);
    if (!post) throw notFound();
    return { authorId: post.author?._id, postId: post._id };
  }
  const comment = await repo.findCommentById(id);
  if (!comment || !(await repo.findPublishedPost(comment.post))) throw commentNotFound();
  return { authorId: comment.author, postId: comment.post };
}

/**
 * Set the user's like / love / celebrate on a post or comment (a second pick of another type switches it).
 * @param {'post'|'comment'} targetType
 */
export async function react(user, targetType, id, type) {
  const target = await reactionTarget(targetType, id);
  const previous = await repo.setReaction(targetType, id, user._id, type);
  if (targetType === 'post') {
    if (previous?.type !== type) await repo.incrementPost(id, { [`reactionCounts.${type}`]: 1, ...(previous && { [`reactionCounts.${previous.type}`]: -1 }) });
  } else if (!previous) await repo.incrementComment(id, { reactionCount: 1 });
  if (!previous) await notifyAuthor(target.authorId, user, `${who(user)} reacted to your ${targetType}`, target.postId);
  return { type };
}

/** Take the user's reaction back. */
export async function unreact(user, targetType, id) {
  await reactionTarget(targetType, id);
  const removed = await repo.removeReaction(targetType, id, user._id);
  if (removed && targetType === 'post') await repo.incrementPost(id, { [`reactionCounts.${removed.type}`]: -1 });
  if (removed && targetType === 'comment') await repo.incrementComment(id, { reactionCount: -1 });
  return { type: null };
}

/** `POST /posts/:id/comments`: a comment, or a reply to a top-level comment (one level only). */
export async function addComment(user, postId, { body, parentId }) {
  const post = await repo.findPublishedPost(postId);
  if (!post) throw notFound();
  let parent = null;
  if (parentId) {
    parent = await repo.findCommentById(parentId);
    if (!parent || !same(parent.post, post._id)) throw commentNotFound();
    if (parent.parent) throw fieldError('parentId', 'Reply to the comment itself');
  }
  const comment = await repo.createComment({ post: post._id, author: user._id, parent: parent?._id ?? null, body });
  await repo.incrementPost(post._id, { commentCount: 1 });
  if (parent) {
    await repo.incrementComment(parent._id, { replyCount: 1 });
    await notifyAuthor(parent.author, user, `${who(user)} replied to your comment`, post._id, excerpt(body));
  }
  if (!parent || !same(parent.author, post.author?._id)) await notifyAuthor(post.author?._id, user, `${who(user)} commented on your post`, post._id, excerpt(body));
  return presentComment(comment.toObject(), { full: true, liked: {} });
}

async function ownComment(user, id) {
  const comment = await repo.findCommentById(id);
  if (!comment) throw commentNotFound();
  if (!same(comment.author, user._id)) throw notYours('comment');
  return comment;
}

/** `PATCH /comments/:id`: the author edits their comment. */
export async function editComment(user, id, { body }) {
  await ownComment(user, id);
  return presentComment(await repo.updateCommentBody(id, body), { full: true });
}

async function dropComment(comment) {
  const removed = await repo.deleteCommentTree(comment._id);
  await repo.incrementPost(comment.post, { commentCount: -removed });
  if (comment.parent) await repo.incrementComment(comment.parent, { replyCount: -1 });
}

/** `DELETE /comments/:id`: the author deletes it with its replies. */
export async function deleteComment(user, id) {
  await dropComment(await ownComment(user, id));
}

/** `POST /comments/:id/remove` (`posts.moderate`): Kaluppa removes a comment with a reason; the author is told why. */
export async function removeComment(user, id, { reason }) {
  const comment = await repo.findCommentById(id);
  if (!comment) throw commentNotFound();
  await dropComment(comment);
  await audit.record({ actor: user, area: 'hub', action: 'remove', entity: { type: 'comment', id: comment._id, label: excerpt(comment.body, 40) }, after: { removalReason: reason }, fields: ['removalReason'] });
  if (!same(comment.author, user._id)) {
    await notifyUsers([comment.author], { type: 'post_removed', title: 'Kaluppa removed your comment', body: `“${excerpt(comment.body)}” · ${reason}`, link: postLink(comment.post), data: { postId: comment.post } });
  }
}
