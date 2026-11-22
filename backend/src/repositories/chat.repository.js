import { Conversation } from '../models/conversation.model.js';
import { ConversationMember } from '../models/conversationMember.model.js';

/**
 * The conversation with this key, created on first use (race-safe through the unique key).
 * @param {string} pairKey
 * @param {{ type: string, association?: unknown }} fields set only when it's created
 */
export const upsertConversation = (pairKey, fields) =>
  Conversation.findOneAndUpdate({ pairKey }, { $setOnInsert: { pairKey, ...fields } }, { upsert: true, new: true, lean: true });

/** Add a member, or reopen one whose membership ended. `who` is `{ user }` or `{ team: 'kaluppa' }`. */
export const upsertMember = (conversationId, who) =>
  ConversationMember.updateOne(
    { conversation: conversationId, user: who.user ?? null, team: who.team ?? null },
    { $set: { canPost: true, leftAt: null }, $setOnInsert: { joinedAt: new Date() } },
    { upsert: true },
  );

export const findConversationIdsByKeys = async (pairKeys) =>
  (await Conversation.find({ pairKey: { $in: pairKeys } }, '_id').lean()).map((c) => c._id);

/** Make memberships read-only; the history stays. `users` null = every member of those conversations. */
export const closeMemberships = (conversationIds, users = null) =>
  ConversationMember.updateMany(
    { conversation: { $in: conversationIds }, leftAt: null, ...(users && { user: { $in: users } }) },
    { $set: { canPost: false, leftAt: new Date() } },
  );
