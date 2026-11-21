import { randomUUID } from 'node:crypto';

// Delete the key only if we still own it (it may have expired and been taken by another instance).
const RELEASE = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

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
  if ((await redis.set(key, token, 'PX', ttlMs, 'NX')) !== 'OK') return { acquired: false };
  try {
    return { acquired: true, result: await task() };
  } finally {
    await redis.eval(RELEASE, 1, key, token);
  }
}
