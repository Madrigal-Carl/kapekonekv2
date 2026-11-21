import { createAdapter } from '@socket.io/redis-adapter';
import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { createValkeyConnection } from '../config/valkey.js';
import { realtime } from './realtime.js';

/**
 * Attach Socket.IO with the Valkey adapter so emits reach sockets on every instance.
 * Cookie auth and the `user:<id>` room join are added in M5 (Task 5.1).
 * @param {import('node:http').Server} httpServer
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.CLIENT_URL, credentials: true },
    adapter: createAdapter(createValkeyConnection('socket-pub'), createValkeyConnection('socket-sub')),
  });
  realtime.init(io);
  return io;
}
