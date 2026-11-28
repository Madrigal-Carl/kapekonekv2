import { closeMemberships, findConversationIdsByKeys, upsertConversation, upsertMember } from '../repositories/chat.repository.js';
import { realtime } from '../sockets/realtime.js';

// Memberships (PHASE-2-SPEC §3.9). Every change reaches the member's open sockets at once.

/** `direct:<a>:<b>` with the ids sorted, so a pair has one chat. */
export const directKey = (a, b) => `direct:${[String(a), String(b)].sort().join(':')}`;

/** Add the user (or reopen their membership), join their sockets to the room and tell them. */
async function addMember(conversationId, userId) {
  await upsertMember(conversationId, { user: userId });
  realtime.joinConversation(userId, conversationId);
  realtime.toUser(userId, 'conversation:updated', { conversationId: String(conversationId), canPost: true });
}

/** Read-only now: their sockets leave the room and get `conversation:updated` (Review Focus 4). */
async function closeAndTell(conversationIds, users = null) {
  for (const { conversation, user } of await closeMemberships(conversationIds, users)) {
    if (!user) continue;
    realtime.leaveConversation(user, conversation);
    realtime.toUser(user, 'conversation:updated', { conversationId: String(conversation), canPost: false });
  }
}

/** The user's chat with the Kaluppa team; created with every farmer and Group Manager. */
export async function ensureKaluppaChat(userId) {
  const conversation = await upsertConversation(`kaluppa:${userId}`, { type: 'kaluppa' });
  await Promise.all([addMember(conversation._id, userId), upsertMember(conversation._id, { team: 'kaluppa' })]);
  return conversation;
}

/** The direct chat between two people (both members, open). */
export async function ensureDirectChat(a, b) {
  const conversation = await upsertConversation(directKey(a, b), { type: 'direct' });
  await Promise.all([addMember(conversation._id, a), addMember(conversation._id, b)]);
  return conversation;
}

/** The association's group chat. */
export const ensureGroupChat = (associationId) =>
  upsertConversation(`group:${associationId}`, { type: 'group', association: associationId });

/** Add the user to the association's group chat, or reopen their ended membership. */
export async function joinGroup(userId, associationId) {
  const conversation = await ensureGroupChat(associationId);
  await addMember(conversation._id, userId);
  return conversation;
}

/** The user can still read these chats but no longer post. */
export const endMembership = (userId, conversationIds) => closeAndTell(conversationIds, [userId]);

/** Direct chats between the user and each of the others become read-only for both sides. */
export async function endDirectChatsBetween(userId, otherUserIds) {
  const ids = await findConversationIdsByKeys(otherUserIds.map((other) => directKey(userId, other)));
  if (ids.length) await closeAndTell(ids);
}

/** Every membership of the chat turns read-only (an archived association's group chat). */
export const closeChat = (conversationId) => closeAndTell([conversationId]);
