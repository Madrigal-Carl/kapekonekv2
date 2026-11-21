/**
 * The only way services talk to Socket.IO. Used for `notification:new` and `order:updated`.
 * Calls before `init` (tests, seeders, CLI commands) are no-ops.
 */
let io;

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
};
