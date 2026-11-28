/**
 * The only way services talk to Socket.IO: `notification:new`, `order:updated`, `bean:updated` and the Inbox events.
 * Calls before `init` (tests, seeders, CLI commands) are no-ops.
 */
let io;

/** Rooms of a chat: its own, plus `team:kaluppa` for Kaluppa chats (Kaluppa accounts don't join each one). */
const roomsOf = (conversation) => [`conversation:${conversation._id ?? conversation.id}`, ...(conversation.type === 'kaluppa' ? ['team:kaluppa'] : [])];

export const realtime = {
  /** @param {import('socket.io').Server} server */
  init(server) {
    io = server;
  },

  /**
   * Emit to every socket of one user (room `user:<id>`).
   * @param {unknown} userId
   * @param {string} event
   * @param {unknown} payload
   */
  toUser(userId, event, payload) {
    io?.to(`user:${userId}`).emit(event, payload);
  },

  /**
   * Emit to every member's sockets of a chat.
   * @param {{ _id?: unknown, id?: unknown, type: string }} conversation
   */
  toConversation(conversation, event, payload) {
    io?.to(roomsOf(conversation)).emit(event, payload);
  },

  /** Add or remove all of a user's open sockets to/from a chat's room (joined a group, chat created, left). */
  joinConversation(userId, conversationId) {
    io?.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`);
  },
  leaveConversation(userId, conversationId) {
    io?.in(`user:${userId}`).socketsLeave(`conversation:${conversationId}`);
  },

  roomsOf,
};
