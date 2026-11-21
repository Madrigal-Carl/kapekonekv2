import { createAdapter } from '@socket.io/redis-adapter';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { createValkeyConnection } from '../config/valkey.js';
import { userFromAccessToken } from '../services/auth.service.js';
import { realtime } from './realtime.js';

/**
 * Attach Socket.IO with the Valkey adapter so emits reach sockets on every instance.
 * The handshake must carry a valid `accessToken` cookie; each socket joins only `user:<id>`.
 * Sockets are push-only (`notification:new`, `order:updated`): no client events are handled.
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
      socket.data.userId = String((await userFromAccessToken(token))._id);
      next();
    } catch (error) {
      next(new Error(error.message || 'Please log in to continue.'));
    }
  });
  io.on('connection', (socket) => socket.join(`user:${socket.data.userId}`));
  realtime.init(io);
  return io;
}
