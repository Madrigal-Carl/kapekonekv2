import { isDbConnected } from '../config/db.js';
import { getValkey } from '../config/valkey.js';

const PING_TIMEOUT_MS = 2000;

async function valkeyUp() {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PING_TIMEOUT_MS).unref());
    return (await Promise.race([getValkey().ping(), timeout])) === 'PONG';
  } catch {
    return false;
  }
}

/**
 * Report whether Mongo and Valkey are reachable.
 * @returns {Promise<{ status: 'ok' | 'degraded', checks: { mongo: 'up' | 'down', valkey: 'up' | 'down' } }>}
 */
export async function getHealth() {
  const checks = { mongo: isDbConnected() ? 'up' : 'down', valkey: (await valkeyUp()) ? 'up' : 'down' };
  return { status: Object.values(checks).every((c) => c === 'up') ? 'ok' : 'degraded', checks };
}
