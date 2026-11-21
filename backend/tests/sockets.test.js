import http from 'node:http';
import { io as connect } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

// In-memory adapter instead of the Valkey one: one process, no pub/sub needed.
vi.mock('@socket.io/redis-adapter', () => ({ createAdapter: () => undefined }));
vi.mock('../src/config/valkey.js', async () => {
  const { default: RedisMock } = await import('ioredis-mock');
  const redis = new RedisMock();
  return { getValkey: () => redis, createValkeyConnection: () => new RedisMock() };
});

const { initSockets } = await import('../src/sockets/index.js');
const { realtime } = await import('../src/sockets/realtime.js');
const { runSeeders } = await import('../src/database/seeders/index.js');
const { User } = await import('../src/models/index.js');
const { signAccessToken } = await import('../src/utils/tokens.js');

let server;
let io;
let url;
const clients = [];

/** Connect with the given cookie header; resolves on connect, rejects with the server's refusal. */
function open(cookie) {
  const socket = connect(url, { transports: ['websocket'], extraHeaders: cookie ? { cookie } : {}, reconnection: false, forceNew: true });
  clients.push(socket);
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}
const cookieFor = async (email) => `accessToken=${signAccessToken(await User.findOne({ email }).lean())}`;
const nextEvent = (socket, event, ms = 300) =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

beforeAll(async () => {
  await startMemoryDb();
  await runSeeders({ only: ['roles', 'users'], log: () => {} });
  server = http.createServer();
  io = initSockets(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  for (const socket of clients) socket.close();
  await io.close();
  await stopMemoryDb();
});

describe('socket auth and user rooms', () => {
  it('refuses a handshake without a valid accessToken cookie', async () => {
    await expect(open()).rejects.toThrow(/log in/i);
    await expect(open('accessToken=not-a-jwt')).rejects.toThrow();
  });

  it('delivers realtime.toUser only to that user’s sockets', async () => {
    const buyer = await open(await cookieFor('buyer@kapekonek.test'));
    const other = await open(await cookieFor('kaluppa@kapekonek.test'));
    const buyerId = (await User.findOne({ email: 'buyer@kapekonek.test' }).lean())._id;

    const [mine, theirs] = await Promise.all([
      nextEvent(buyer, 'order:updated'),
      nextEvent(other, 'order:updated'),
      Promise.resolve(realtime.toUser(buyerId, 'order:updated', { id: 'o1', status: 'reserved' })),
    ]);
    expect(mine).toEqual({ id: 'o1', status: 'reserved' });
    expect(theirs).toBeNull();
  });

  it('registers no chat handlers and joins no room besides the user room', async () => {
    await open(await cookieFor('buyer@kapekonek.test'));
    const [socket] = await io.fetchSockets();
    expect([...socket.rooms].filter((room) => room !== socket.id)).toEqual([expect.stringMatching(/^user:[a-f0-9]{24}$/)]);
    const server = io.of('/').sockets.get(socket.id);
    expect(server.eventNames().filter((name) => /^(conversation|message):/.test(name))).toEqual([]);
  });
});
