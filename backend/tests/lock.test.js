import RedisMock from 'ioredis-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startOrderExpiryScheduler } from '../src/schedulers/orderExpiry.scheduler.js';
import { withLock } from '../src/utils/lock.js';

let redis;
beforeEach(async () => {
  redis = new RedisMock();
  await redis.flushall();
});

describe('withLock', () => {
  it('runs the task and releases the lock', async () => {
    expect(await withLock(redis, 'lock:t', 1000, async () => 7)).toEqual({ acquired: true, result: 7 });
    expect(await redis.get('lock:t')).toBeNull();
  });

  it('skips while another holder has the lock', async () => {
    let release;
    const first = withLock(redis, 'lock:t', 1000, () => new Promise((r) => { release = r; }));
    await vi.waitFor(async () => expect(await redis.get('lock:t')).not.toBeNull());
    expect(await withLock(redis, 'lock:t', 1000, async () => 'second')).toEqual({ acquired: false });
    release('first');
    expect(await first).toEqual({ acquired: true, result: 'first' });
  });

  it("does not delete a lock that expired and was taken by someone else", async () => {
    await withLock(redis, 'lock:t', 1000, async () => { await redis.set('lock:t', 'other-holder'); });
    expect(await redis.get('lock:t')).toBe('other-holder');
  });

  it('releases the lock when the task throws', async () => {
    await expect(withLock(redis, 'lock:t', 1000, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await redis.get('lock:t')).toBeNull();
  });
});

describe('startOrderExpiryScheduler', () => {
  it('runs once at start, then on the interval, and stops cleanly', async () => {
    vi.useFakeTimers();
    const sweep = vi.fn(async () => ({ expired: 0 }));
    const logger = { log: vi.fn(), error: vi.fn() };
    const stop = startOrderExpiryScheduler(sweep, { intervalMs: 1000, logger });
    await vi.advanceTimersByTimeAsync(0);
    expect(sweep).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sweep).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(sweep).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('logs a failed sweep instead of crashing', async () => {
    const logger = { log: vi.fn(), error: vi.fn() };
    const stop = startOrderExpiryScheduler(async () => { throw new Error('db down'); }, { intervalMs: 60_000, logger });
    await vi.waitFor(() => expect(logger.error).toHaveBeenCalled());
    stop();
  });
});
