import { Conversation } from '../models/conversation.model.js';
import { ConversationMember } from '../models/conversationMember.model.js';
import { Message } from '../models/message.model.js';
import { cursorFilter, cursorSort, pageResult } from '../utils/pagination.js';

/**
 * The conversation with this key, created on first use (race-safe through the unique key).
 * @param {string} pairKey
 * @param {{ type: string, association?: unknown }} fields set only when it's created
 */
export const upsertConversation = (pairKey, fields) =>
  Conversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { pairKey, ...fields } }, { upsert: true, returnDocument: 'after', lean: true });

/** Add a member, or reopen one whose membership ended. `who` is `{ user }` or `{ team: 'kaluppa' }`. */
export const upsertMember = (conversationId, who) =>
  ConversationMember.updateOne(
    { conversation: conversationId, user: who.user ?? null, team: who.team ?? null },
    { $set: { canPost: true, leftAt: null }, $setOnInsert: { joinedAt: new Date() } },
    { upsert: true },
  );

export const findConversationIdsByKeys = async (pairKeys) =>
  (await Conversation.find({ pairKey: { $in: pairKeys } }, '_id').lean()).map((c) => c._id);

/**
 * Make memberships read-only; the history stays. `users` null = every member of those conversations.
 * @returns {Promise<{ conversation: unknown, user: unknown }[]>} the memberships that were open
 */
export async function closeMemberships(conversationIds, users = null) {
  const filter = { conversation: { $in: conversationIds }, leftAt: null, ...(users && { user: { $in: users } }) };
  const open = await ConversationMember.find(filter, 'conversation user').lean();
  await ConversationMember.updateMany({ _id: { $in: open.map((m) => m._id) } }, { $set: { canPost: false, leftAt: new Date() } });
  return open;
}

// ── Inbox (M12) ────────────────────────────────────────────────────────────

const PERSON = 'firstName lastName roles';
const CONVERSATION = [{ path: 'association', select: 'name groupManager' }, { path: 'lastMessage.sender', select: PERSON }];
const MESSAGE = [{ path: 'sender', select: PERSON }, { path: 'replyTo', populate: { path: 'sender', select: PERSON } }];
const NEWEST = { sortField: 'createdAt', direction: 'desc' };

/** Messages this member may see: not hidden by "Delete for me", and none after the membership ended. */
const visible = ({ conversationId, userId, leftAt }) => ({
  conversation: conversationId,
  deletedFor: { $ne: userId },
  ...(leftAt && { createdAt: { $lte: leftAt } }),
});

export const findConversationById = (id) => Conversation.findById(id).populate(CONVERSATION).lean();

/** The conversations with these ids; `withMessagesOnly` leaves out chats nobody wrote in yet. */
export const findConversationsByIds = (ids, { withMessagesOnly = false } = {}) =>
  Conversation.find({ _id: { $in: ids }, ...(withMessagesOnly && { 'lastMessage.at': { $ne: null } }) }).populate(CONVERSATION).lean();

/** `owner` is `{ user }` or `{ team: 'kaluppa' }`. */
export const findMember = (conversationId, owner) =>
  ConversationMember.findOne({ conversation: conversationId, user: owner.user ?? null, team: owner.team ?? null }).lean();

export const findMembershipsOf = (owner) => ConversationMember.find({ user: owner.user ?? null, team: owner.team ?? null }).lean();

/** Every member of these conversations, with the person's name and roles. */
export const findMembersOf = (conversationIds) => ConversationMember.find({ conversation: { $in: conversationIds } }).populate('user', PERSON).lean();

export const markDelivered = (memberIds, at) => ConversationMember.updateMany({ _id: { $in: memberIds } }, { lastDeliveredAt: at });

export const markRead = (memberId, at) =>
  ConversationMember.findByIdAndUpdate(memberId, { lastReadAt: at, lastDeliveredAt: at, unreadCount: 0 }, { returnDocument: 'after', lean: true });

/** Chats with unread messages, for the sidebar badge. */
export const countUnreadChats = (owner) => ConversationMember.countDocuments({ user: owner.user ?? null, team: owner.team ?? null, unreadCount: { $gt: 0 } });

export const createMessage = (data) => Message.create(data);

export const findMessageById = (id) => Message.findById(id).lean();

export const findMessageWithPeople = (id) => Message.findById(id).populate(MESSAGE).lean();

/** A message this member can see in this conversation (a reply target). */
export const findVisibleMessage = (scope, id) => Message.exists({ _id: id, ...visible(scope) });

/** Newest first, `limit` per page, before the `cursor`. */
export async function listVisibleMessages(scope, { cursor, limit }) {
  const docs = await Message.find({ ...visible(scope), ...cursorFilter({ ...NEWEST, cursor }) })
    .sort(cursorSort(NEWEST))
    .limit(limit + 1)
    .populate(MESSAGE)
    .lean();
  return pageResult(docs, limit, 'createdAt');
}

/** The newest message the member can see; `senderId` narrows it to that sender's (not deleted for everyone). */
export const findLastVisibleMessage = (scope, senderId = null) =>
  Message.findOne({ ...visible(scope), ...(senderId && { sender: senderId, deletedForEveryoneAt: null }) })
    .sort({ createdAt: -1, _id: -1 })
    .populate(MESSAGE)
    .lean();

/** After a send: the chat's preview, +1 unread for every other current member, and the sender has read up to it. */
export async function recordSent(conversationId, senderMemberId, lastMessage) {
  await Promise.all([
    Conversation.updateOne({ _id: conversationId }, { lastMessage }),
    ConversationMember.updateMany({ conversation: conversationId, _id: { $ne: senderMemberId }, leftAt: null }, { $inc: { unreadCount: 1 } }),
    ConversationMember.updateOne({ _id: senderMemberId }, { lastReadAt: lastMessage.at, lastDeliveredAt: lastMessage.at, unreadCount: 0 }),
  ]);
}

export const updateMessage = (id, update) => Message.findByIdAndUpdate(id, update, { returnDocument: 'after' }).populate(MESSAGE).lean();

/** Keep the chat's preview in step when its last message is edited or deleted. */
export const setLastMessageText = (conversationId, messageId, text) =>
  Conversation.updateOne({ _id: conversationId, 'lastMessage.message': messageId }, { 'lastMessage.text': text });

export const hideMessageFor = (id, userId) => Message.updateOne({ _id: id }, { $addToSet: { deletedFor: userId } });
