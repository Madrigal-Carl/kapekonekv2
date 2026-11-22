import { randomUUID } from 'node:crypto';

// Delete the key only if we still own it (it may have expired and been taken by another instance).
const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

/**
 * Wait (up to 5 s) for a connection to be ready. The cache connection has no offline queue, so a command sent
 * while it is still connecting (the seeder, or the expiry sweep right at boot) would otherwise fail at once.
 * @param {import('ioredis').Redis} client
 */
export async function whenReady(client, ms = 5000) {
  if (!client.status || client.status === 'ready') return; // ioredis-mock has no status
  await new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      client.off('ready', done);
      resolve();
    }
    client.once('ready', done);
  });
}

/**
 * Run `task` while holding a Valkey lock (`SET key token NX PX ttl`).
 * @template T
 * @param {import('ioredis').Redis} redis
 * @param {string} key
 * @param {number} ttlMs longer than the task should ever take
 * @param {() => Promise<T>} task
 * @returns {Promise<{ acquired: false } | { acquired: true, result: T }>}
 */
export async function withLock(redis, key, ttlMs, task) {
  const token = randomUUID();
  await whenReady(redis);
  if ((await redis.set(key, token, 'PX', ttlMs, 'NX')) !== 'OK') return { acquired: false };
  try {
    return { acquired: true, result: await task() };
  } finally {
    await redis.eval(RELEASE, 1, key, token);
  }
}
