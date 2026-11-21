import { nextSequence } from '../repositories/counter.repository.js';
import { manilaDateKey } from './manilaDate.js';

/**
 * Next order number for the Manila calendar day: `KK-YYYYMMDD-NNNN`.
 * @param {Date} [at]
 */
export async function nextOrderNumber(at = new Date()) {
  const day = manilaDateKey(at);
  const seq = await nextSequence(`order:${day}`);
  return `KK-${day}-${String(seq).padStart(4, '0')}`;
}
