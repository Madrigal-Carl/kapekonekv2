/**
 * Run `sweep` now and then every `intervalMs`, never overlapping itself.
 * The sweep is injected so scheduling can be tested without Mongo or Valkey.
 * @param {() => Promise<object>} sweep
 * @param {{ intervalMs: number, logger?: Pick<Console, 'log' | 'error'> }} options
 * @returns {() => void} stop
 */
export function startOrderExpiryScheduler(sweep, { intervalMs, logger = console }) {
  if (!Number.isSafeInteger(intervalMs) || intervalMs <= 0 || intervalMs > 2_147_483_647) {
    throw new Error('ORDER_EXPIRY_INTERVAL_MINUTES must give a positive interval of at most 2147483647 ms');
  }

  let running = false;
  let stopped = false;
  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      const summary = await sweep();
      if (summary?.expired) logger.log('[order-expiry]', summary);
    } catch (error) {
      logger.error('[order-expiry] sweep failed:', error.message);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void run(), intervalMs);
  timer.unref();
  void run();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
