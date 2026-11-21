import { Redis } from 'ioredis';
import { env } from './env.js';

const connections = new Set();

/**
 * One ioredis connection per consumer (queue, worker, socket pub/sub, cache).
 * @param {string} name shown in logs and CLIENT LIST
 * @param {import('ioredis').RedisOptions} [overrides]
 * @returns {Redis}
 */
export function createValkeyConnection(name, overrides = {}) {
  const connection = new Redis({
    host: env.VALKEY_HOST,
    port: env.VALKEY_PORT,
    username: env.VALKEY_USERNAME,
    password: env.VALKEY_PASSWORD,
    tls: env.VALKEY_TLS ? {} : undefined,
    connectionName: `kapekonek:${name}`,
    maxRetriesPerRequest: null, // required by BullMQ
    ...overrides,
  });
  let lastError = '';
  connection.on('error', (error) => {
    if (error.message !== lastError) console.error(`[valkey:${name}] ${error.message}`); // ioredis retries forever; log each new error once
    lastError = error.message;
  });
  connection.on('ready', () => { lastError = ''; });
  connections.add(connection);
  return connection;
}

let cache;
/** Shared connection for cache, locks and rate limits. Commands fail fast instead of queueing while Valkey is down. */
export const getValkey = () => (cache ??= createValkeyConnection('cache', { maxRetriesPerRequest: 1 }));

export async function closeValkeyConnections() {
  await Promise.allSettled([...connections].map((c) => c.quit()));
  connections.clear();
  cache = undefined;
}
