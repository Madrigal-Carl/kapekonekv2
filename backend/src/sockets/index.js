import { createAdapter } from '@socket.io/redis-adapter';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { createValkeyConnection } from '../config/valkey.js';
import { userFromAccessToken } from '../services/auth.service.js';
import { acknowledgeDelivered, roomsFor, typingIn } from '../services/inbox.service.js';
import { userCan } from '../services/permission.service.js';
import { realtime } from './realtime.js';

/**
 * Attach Socket.IO with the Valkey adapter so emits reach sockets on every instance.
 * The handshake must carry a valid `accessToken` cookie; each socket joins `user:<id>`.
 * Inbox users also join their open chats (`conversation:<id>`, or `team:kaluppa`) and may send two events:
 * `typing` and `conversation:delivered` (PHASE-2-SPEC §6). Everything else is server push.
 * @param {import('node:http').Server} httpServer
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    adapter: createAdapter(createValkeyConnection('socket-pub'), createValkeyConnection('socket-sub')),
  });
  io.engine.use(cookieParser());
  io.use(async (socket, next) => {
    try {
      const token = socket.request.cookies?.accessToken;
      if (!token) throw new Error('Please log in to continue.');
      socket.data.user = await userFromAccessToken(token);
      socket.data.userId = String(socket.data.user._id);
      next();
    } catch (error) {
      next(new Error(error.message || 'Please log in to continue.'));
    }
  });
  io.on('connection', async (socket) => {
    socket.join(`user:${socket.data.userId}`);
    const { user } = socket.data;
    if (!(await userCan(user, 'inbox.use'))) return;
    socket.join(await roomsFor(user));
    // Membership is re-checked on every event; a bad id is ignored.
    socket.on('typing', async ({ conversationId } = {}) => {
      const target = await typingIn(user, conversationId);
      if (target) socket.to(target.rooms).emit('typing', target.payload);
    });
    socket.on('conversation:delivered', ({ conversationId } = {}) => acknowledgeDelivered(user, conversationId).catch(() => {}));
  });
  realtime.init(io);
  return io;
}
