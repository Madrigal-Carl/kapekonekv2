import { ROLE_LABELS, ROLES } from '../constants/permissions.js';
import { findAssociationById, findAssociationsByManagers } from '../repositories/association.repository.js';
import * as repo from '../repositories/chat.repository.js';
import { findApprovedFarmerIds, findProfilesByUsers } from '../repositories/farmerProfile.repository.js';
import { findInboxContacts, findUserById } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { loadScope } from './auth.service.js';
import { realtime } from '../sockets/realtime.js';
import { ensureDirectChat, ensureKaluppaChat } from './chat.service.js';
import { isKaluppaTeam } from './policy.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

// The Inbox (PHASE-2-SPEC §3.9). Kaluppa accounts act as one `team:kaluppa` member in every Kaluppa chat.

const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETED = 'This message was deleted';
const INBOX_ROLES = [ROLES.FARMER, ROLES.GROUP_MANAGER, ROLES.KALUPPA];
const KALUPPA = { id: 'kaluppa', name: 'Kaluppa', initials: 'K' };
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

const same = (a, b) => a != null && b != null && String(a) === String(b);
const fullName = (u) => `${u.firstName} ${u.lastName}`;
const initialsOf = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
const notFound = () => new AppError(404, 'We couldn’t find that chat.');
const readOnly = () => new AppError(403, 'This chat is read-only. Its history stays here.');
const fieldError = (field, message) => new AppError(400, 'Please check the highlighted fields.', { errors: { [field]: message } });

/** Whose membership a user acts through: the team's in Kaluppa chats, their own everywhere else. */
const ownerIn = (user, conversation) => (conversation.type === 'kaluppa' && isKaluppaTeam(user) ? { team: 'kaluppa' } : { user: user._id });
const ownerOf = (user) => (isKaluppaTeam(user) ? { team: 'kaluppa' } : { user: user._id });
const scopeOf = (user, member) => ({ conversationId: member.conversation, userId: user._id, leftAt: member.leftAt });

/**
 * May `user` start a chat with `other`? Both carry their session scope (`roles`, `associationId`).
 * Kaluppa ↔ anyone; otherwise only people of the same association (co-farmers, a farmer and its Group Manager).
 * @param {{ _id: unknown, roles: string[], associationId?: unknown }} user
 * @param {{ _id: unknown, roles: string[], associationId?: unknown }} other
 */
export function canMessage(user, other) {
  if (same(user._id, other._id) || !other.roles.some((r) => INBOX_ROLES.includes(r))) return false;
  if (isKaluppaTeam(user) || isKaluppaTeam(other)) return isKaluppaTeam(user) !== isKaluppaTeam(other);
  return same(user.associationId, other.associationId);
}

/**
 * Sent / Delivered / Seen for a message sent at `at`, from the other members' cursors. Groups say "Seen by N".
 * @param {Date} at
 * @param {{ lastDeliveredAt?: Date|null, lastReadAt?: Date|null }[]} others
 * @param {'kaluppa'|'direct'|'group'} type
 */
export function receiptFor(at, others, type) {
  const reached = (cursor) => cursor != null && new Date(cursor) >= new Date(at);
  const seenBy = others.filter((o) => reached(o.lastReadAt));
  if (seenBy.length) return { state: 'seen', label: type === 'group' ? `Seen by ${seenBy.length}` : 'Seen', seenBy };
  if (others.some((o) => reached(o.lastDeliveredAt))) return { state: 'delivered', label: 'Delivered', seenBy: [] };
  return { state: 'sent', label: 'Sent', seenBy: [] };
}

/** "Farmer · Santa Cruz Growers" for each user id (association only when approved / assigned). */
async function peopleSubs(users) {
  const ids = users.map((u) => u._id);
  const [profiles, managed] = await Promise.all([findProfilesByUsers(ids), findAssociationsByManagers(ids)]);
  const names = new Map([
    ...profiles.filter((p) => p.status === 'approved' && p.association).map((p) => [String(p.user), p.association.name]),
    ...managed.map((a) => [String(a.groupManager), a.name]),
  ]);
  return new Map(
    users.map((u) => {
      const role = ROLE_LABELS[u.roles.find((r) => INBOX_ROLES.includes(r))] ?? '';
      const association = names.get(String(u._id));
      return [String(u._id), association ? `${role} · ${association}` : role];
    }),
  );
}

const personOf = (u) => ({ id: String(u._id), name: fullName(u), initials: initialsOf(fullName(u)) });
const authorOf = (sender) => (isKaluppaTeam(sender) ? `${sender.firstName} · Kaluppa` : fullName(sender));
const previewOf = (m) => (m.deletedForEveryoneAt ? DELETED : m.body || (m.attachments[0]?.kind === 'image' ? 'Photo' : 'File'));

/** The message as the viewer sees it. */
function toMessage(user, m) {
  const deleted = Boolean(m.deletedForEveryoneAt);
  return {
    id: String(m._id),
    conversationId: String(m.conversation),
    body: deleted ? null : m.body,
    attachments: deleted ? [] : m.attachments.map(({ url, name, kind, bytes }) => ({ url, name, kind, bytes })),
    replyTo:
      !deleted && m.replyTo
        ? { id: String(m.replyTo._id), author: authorOf(m.replyTo.sender), mine: same(m.replyTo.sender._id, user._id), text: previewOf(m.replyTo) }
        : null,
    sender: { ...personOf(m.sender), team: isKaluppaTeam(m.sender) ? 'kaluppa' : null },
    author: authorOf(m.sender),
    mine: same(m.sender._id, user._id),
    createdAt: m.createdAt,
    editedAt: deleted ? null : m.editedAt,
    deleted,
  };
}

/**
 * Build the viewer's chat cards for these memberships (name, avatar initials, subtitle, preview, unread, members).
 * @param {object} user
 * @param {object[]} memberships the viewer's own member rows
 */
async function describe(user, memberships, conversations) {
  const byId = new Map(conversations.map((c) => [String(c._id), c]));
  const rows = await repo.findMembersOf(conversations.map((c) => c._id));
  const people = rows.filter((r) => r.user).map((r) => r.user);
  const subs = await peopleSubs([...new Map(people.map((p) => [String(p._id), p])).values()]);
  const cards = [];
  for (const member of memberships) {
    const conversation = byId.get(String(member.conversation));
    if (!conversation) continue;
    const others = rows.filter((r) => same(r.conversation, conversation._id) && !same(r._id, member._id));
    const current = others.filter((r) => !r.leftAt);
    const memberView = (r) => ({ ...(r.team ? KALUPPA : personOf(r.user)), lastDeliveredAt: r.lastDeliveredAt, lastReadAt: r.lastReadAt });
    const other = others.find((r) => r.user) ?? others[0];
    let name;
    let sub;
    if (conversation.type === 'group') {
      name = conversation.association?.name ?? 'Group chat';
      const count = current.length + (member.leftAt ? 0 : 1);
      const manager = current.find((r) => same(r.user?._id, conversation.association?.groupManager));
      sub = manager ? `${count} members · ${manager.user.firstName} and ${count - 1} farmers` : `${count} members`;
    } else if (conversation.type === 'kaluppa' && !member.team) {
      name = KALUPPA.name;
      sub = 'Kaluppa team · replies within a day';
    } else {
      name = other?.user ? fullName(other.user) : 'Former member';
      sub = other?.user ? subs.get(String(other.user._id)) : '';
    }
    if (member.leftAt) sub = `Read-only · you left on ${SHORT_DATE.format(member.leftAt)}`;
    // A former member's preview stops where their history stops.
    const last = member.leftAt ? await repo.findLastVisibleMessage(scopeOf(user, member)) : null;
    const lastMessage = member.leftAt
      ? last && { text: previewOf(last), at: last.createdAt, mine: same(last.sender._id, user._id), senderName: last.sender.firstName }
      : conversation.lastMessage?.at && {
          text: conversation.lastMessage.text,
          at: conversation.lastMessage.at,
          mine: same(conversation.lastMessage.sender?._id, user._id),
          senderName: conversation.lastMessage.sender?.firstName ?? '',
        };
    cards.push({
      id: String(conversation._id),
      type: conversation.type,
      name,
      initials: conversation.type === 'kaluppa' && !member.team ? KALUPPA.initials : initialsOf(name),
      sub,
      canPost: member.canPost && !member.leftAt,
      leftAt: member.leftAt,
      unread: member.unreadCount,
      lastMessage: lastMessage || null,
      memberCount: current.length + (member.leftAt ? 0 : 1),
      members: current.map(memberView),
    });
  }
  return cards;
}

/** The chat and the viewer's membership in it; 404 when they aren't a member. */
async function membershipOr404(user, conversationId) {
  const conversation = await repo.findConversationById(conversationId);
  const member = conversation && (await repo.findMember(conversation._id, ownerIn(user, conversation)));
  if (!member) throw notFound();
  return { conversation, member };
}

/**
 * The viewer's chats. Fetching them counts as delivery of everything up to now.
 * Kaluppa sees farmer and Group Manager chats once someone has written in them; others see their own Kaluppa chat pinned first.
 * @param {{ filter: 'all'|'unread'|'groups', q?: string }} query
 */
export async function listConversations(user, { filter, q }) {
  const memberships = await repo.findMembershipsOf(ownerOf(user));
  const conversations = await repo.findConversationsByIds(
    memberships.map((m) => m.conversation),
    { withMessagesOnly: isKaluppaTeam(user) },
  );
  const now = new Date();
  const lastAt = new Map(conversations.map((c) => [String(c._id), c.lastMessage?.at]));
  const undelivered = memberships.filter((m) => !m.leftAt && lastAt.get(String(m.conversation)) > (m.lastDeliveredAt ?? 0));
  if (undelivered.length) {
    await repo.markDelivered(undelivered.map((m) => m._id), now);
    const byId = new Map(conversations.map((c) => [String(c._id), c]));
    for (const m of undelivered) realtime.toConversation(byId.get(String(m.conversation)), 'conversation:delivered', { conversationId: String(m.conversation), at: now });
  }

  const pattern = q && containsPattern(q);
  const cards = (await describe(user, memberships, conversations)).filter(
    (c) => (filter !== 'unread' || c.unread > 0) && (filter !== 'groups' || c.type === 'group') && (!pattern || pattern.test(c.name)),
  );
  // shortcut: filtered and sorted in memory; fine for hundreds of chats, page it when Kaluppa has thousands.
  const rank = (c) => (c.type === 'kaluppa' && !isKaluppaTeam(user) ? 1 : 0);
  return cards.sort((x, y) => rank(y) - rank(x) || new Date(y.lastMessage?.at ?? 0) - new Date(x.lastMessage?.at ?? 0));
}

/** One chat card plus the receipt (Sent / Delivered / Seen) of the viewer's last message. */
export async function getConversation(user, conversationId) {
  const { conversation, member } = await membershipOr404(user, conversationId);
  const [card] = await describe(user, [member], [conversation]);
  const mine = await repo.findLastVisibleMessage(scopeOf(user, member), user._id);
  card.receipt = mine ? { messageId: String(mine._id), ...receiptFor(mine.createdAt, card.members, conversation.type) } : null;
  return card;
}

/**
 * Open (or create) the chat with someone. `'kaluppa'` or a Kaluppa account means the Kaluppa team chat.
 * @param {{ userId: string }} body
 */
export async function openDirect(user, { userId }) {
  let conversation;
  if (userId === 'kaluppa') {
    if (isKaluppaTeam(user)) throw fieldError('userId', 'Pick a farmer or Group Manager');
    conversation = await ensureKaluppaChat(user._id);
  } else {
    const other = await findUserById(userId);
    if (!other || other.status !== 'active') throw new AppError(404, 'We couldn’t find that person.');
    await loadScope(other);
    if (!canMessage(user, other)) throw new AppError(403, 'You can’t message this person.');
    if (isKaluppaTeam(user)) conversation = await ensureKaluppaChat(other._id);
    else if (isKaluppaTeam(other)) conversation = await ensureKaluppaChat(user._id);
    else conversation = await ensureDirectChat(user._id, other._id);
  }
  return getConversation(user, conversation._id);
}

/** People the viewer may message, by name (`/inbox/people`). Non-Kaluppa users also get the Kaluppa team. */
export async function listPeople(user, { q = '' }) {
  const words = q.trim().split(/\s+/).filter(Boolean).map(containsPattern);
  let ids = [];
  if (isKaluppaTeam(user)) ids = null;
  else if (user.associationId) {
    const association = await findAssociationById(user.associationId);
    ids = [...(await findApprovedFarmerIds(user.associationId)), ...(association?.groupManager ? [association.groupManager._id] : [])].filter((id) => !same(id, user._id));
  }
  const users = ids === null || ids.length ? await findInboxContacts({ ids, words, limit: 20 }) : [];
  const subs = await peopleSubs(users);
  const people = users.map((u) => ({ ...personOf(u), sub: subs.get(String(u._id)) }));
  const kaluppaMatches = !isKaluppaTeam(user) && words.every((w) => w.test('Kaluppa'));
  return kaluppaMatches ? [{ ...KALUPPA, sub: 'Kaluppa team' }, ...people] : people;
}

/** Older messages, newest first (`?before=<cursor>&limit=30`). */
export async function listMessages(user, conversationId, { before, limit }) {
  const { member } = await membershipOr404(user, conversationId);
  const { items, meta } = await repo.listVisibleMessages(scopeOf(user, member), { cursor: before, limit });
  return { items: items.map((m) => toMessage(user, m)), meta };
}

/** Check each attachment is the sender's own upload and within the upload rules. */
async function checkedAttachments(user, attachments) {
  const out = [];
  for (const file of attachments) {
    if (!isOwnUpload(user, 'message_attachment', file)) throw fieldError('attachments', 'Upload these files again.');
    const { kind, bytes, name } = await assertUploadAllowed('message_attachment', file.publicId, 'attachments');
    out.push({ url: file.url, publicId: file.publicId, name, bytes, kind: kind === 'image' ? 'image' : 'file' });
  }
  return out;
}

/** Send a message (text and/or attachments, optionally replying to one in the same chat). */
export async function sendMessage(user, conversationId, { body, attachments, replyTo }) {
  const { conversation, member } = await membershipOr404(user, conversationId);
  if (!member.canPost || member.leftAt) throw readOnly();
  if (replyTo && !(await repo.findVisibleMessage(scopeOf(user, member), replyTo))) throw fieldError('replyTo', 'That message isn’t in this chat.');
  const files = await checkedAttachments(user, attachments);
  const created = await repo.createMessage({ conversation: conversation._id, sender: user._id, body, attachments: files, replyTo: replyTo ?? null });
  await repo.recordSent(conversation._id, member._id, { message: created._id, text: previewOf(created), sender: user._id, at: created.createdAt });
  // Ids only: each member refetches its own view (`mine`, "Delete for me").
  realtime.toConversation(conversation, 'message:new', { conversationId: String(conversation._id), messageId: String(created._id) });
  return toMessage(user, await repo.findMessageWithPeople(created._id));
}

/** The message, after checking the viewer is a member of its chat. */
async function messageInChat(user, messageId) {
  const message = await repo.findMessageById(messageId);
  if (!message) throw new AppError(404, 'We couldn’t find that message.');
  return { message, ...(await membershipOr404(user, message.conversation)) };
}

/** Edit your own message, within 15 minutes of sending it. */
export async function editMessage(user, messageId, { body }) {
  const { message, member, conversation } = await messageInChat(user, messageId);
  if (!same(message.sender, user._id) || message.deletedForEveryoneAt) throw new AppError(403, 'You can only edit your own messages.');
  if (!member.canPost || member.leftAt) throw readOnly();
  if (Date.now() - new Date(message.createdAt).getTime() > EDIT_WINDOW_MS) throw new AppError(403, 'Messages can be edited for 15 minutes after sending.');
  const updated = await repo.updateMessage(messageId, { body, editedAt: new Date() });
  await repo.setLastMessageText(message.conversation, message._id, previewOf(updated));
  realtime.toConversation(conversation, 'message:updated', { conversationId: String(conversation._id), messageId });
  return toMessage(user, updated);
}

/** Delete for everyone (your own messages, any time; a tombstone stays) or for me (hidden for you only). */
export async function deleteMessage(user, messageId, { for: scope }) {
  const { message, conversation } = await messageInChat(user, messageId);
  const payload = { conversationId: String(conversation._id), messageId };
  if (scope === 'me') {
    await repo.hideMessageFor(messageId, user._id);
    realtime.toUser(user._id, 'message:deleted', payload); // the user's other tabs
    return { id: messageId, for: 'me' };
  }
  if (!same(message.sender, user._id)) throw new AppError(403, 'You can only delete your own messages for everyone.');
  await repo.updateMessage(messageId, { deletedForEveryoneAt: new Date(), body: '', attachments: [] });
  await repo.setLastMessageText(message.conversation, message._id, DELETED);
  realtime.toConversation(conversation, 'message:deleted', payload);
  return { id: messageId, for: 'everyone' };
}

/** Opening a chat: everything in it is seen. */
export async function markConversationRead(user, conversationId) {
  const { conversation, member } = await membershipOr404(user, conversationId);
  const updated = await repo.markRead(member._id, new Date());
  realtime.toConversation(conversation, 'conversation:read', { conversationId: String(conversation._id), at: updated.lastReadAt });
  return { conversationId: String(conversation._id), lastReadAt: updated.lastReadAt };
}

/** Chats with unread messages (sidebar badge `inbox`). */
export const countUnreadChats = (user) => repo.countUnreadChats(ownerOf(user));

// ── Socket side (sockets/index.js) ─────────────────────────────────────────

const TYPING_EXPIRY_MS = 5000;

/** Rooms a socket joins at the handshake: its open chats, and `team:kaluppa` for Kaluppa accounts. */
export async function roomsFor(user) {
  if (isKaluppaTeam(user)) return ['team:kaluppa'];
  const memberships = await repo.findMembershipsOf(ownerOf(user));
  return memberships.filter((m) => !m.leftAt).map((m) => `conversation:${m.conversation}`);
}

/** Where a `typing` event from this user goes, or null when they can't post in the chat. */
export async function typingIn(user, conversationId) {
  const conversation = await repo.findConversationById(conversationId).catch(() => null);
  const member = conversation && (await repo.findMember(conversation._id, ownerIn(user, conversation)));
  if (!member?.canPost || member.leftAt) return null;
  return { rooms: realtime.roomsOf(conversation), payload: { conversationId: String(conversation._id), user: { id: String(user._id), name: user.firstName }, expiresInMs: TYPING_EXPIRY_MS } };
}

/** A recipient's socket received the chat's messages: move its delivered cursor and tell the members. */
export async function acknowledgeDelivered(user, conversationId) {
  const conversation = await repo.findConversationById(conversationId).catch(() => null);
  const member = conversation && (await repo.findMember(conversation._id, ownerIn(user, conversation)));
  if (!member || member.leftAt) return;
  const now = new Date();
  await repo.markDelivered([member._id], now);
  realtime.toConversation(conversation, 'conversation:delivered', { conversationId: String(conversation._id), at: now });
}
