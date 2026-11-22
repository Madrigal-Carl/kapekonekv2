import { closeMemberships, findConversationIdsByKeys, upsertConversation, upsertMember } from '../repositories/chat.repository.js';

// Memberships only (PHASE-2-SPEC §3.9). Messages and the Inbox arrive in M12.

/** `direct:<a>:<b>` with the ids sorted, so a pair has one chat. */
export const directKey = (a, b) => `direct:${[String(a), String(b)].sort().join(':')}`;

/** The user's chat with the Kaluppa team; created with every farmer and Group Manager. */
export async function ensureKaluppaChat(userId) {
  const conversation = await upsertConversation(`kaluppa:${userId}`, { type: 'kaluppa' });
  await Promise.all([upsertMember(conversation._id, { user: userId }), upsertMember(conversation._id, { team: 'kaluppa' })]);
  return conversation;
}

/** The association's group chat. */
export const ensureGroupChat = (associationId) =>
  upsertConversation(`group:${associationId}`, { type: 'group', association: associationId });

/** Add the user to the association's group chat, or reopen their ended membership. */
export async function joinGroup(userId, associationId) {
  const conversation = await ensureGroupChat(associationId);
  await upsertMember(conversation._id, { user: userId });
  return conversation;
}

/** The user can still read these chats but no longer post. */
export const endMembership = (userId, conversationIds) => closeMemberships(conversationIds, [userId]);

/** Direct chats between the user and each of the others become read-only for both sides. */
export async function endDirectChatsBetween(userId, otherUserIds) {
  const ids = await findConversationIdsByKeys(otherUserIds.map((other) => directKey(userId, other)));
  if (ids.length) await closeMemberships(ids);
}

/** Every membership of the chat turns read-only (an archived association's group chat). */
export const closeChat = (conversationId) => closeMemberships([conversationId]);
