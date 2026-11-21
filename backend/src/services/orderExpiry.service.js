import { getValkey } from '../config/valkey.js';
import { withLock } from '../utils/lock.js';
import { expirePendingOrders } from './orderStatus.service.js';

const LOCK_KEY = 'lock:order-expiry';
const LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * Expire pending orders past ORDER_EXPIRY_DAYS. Used by the scheduler and the cron route;
 * the lock keeps two instances (or a scheduler tick and a cron call) from sweeping at once.
 * @returns {Promise<{ expired: number, skipped?: true }>}
 */
export async function runOrderExpiry() {
  const outcome = await withLock(getValkey(), LOCK_KEY, LOCK_TTL_MS, () => expirePendingOrders(new Date()));
  return outcome.acquired ? { expired: outcome.result } : { expired: 0, skipped: true };
}
