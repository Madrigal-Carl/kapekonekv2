const MANILA_OFFSET_MS = 8 * 3600_000; // Asia/Manila is UTC+8 all year (no DST)

/**
 * Add `n` business days (Mon–Fri, no holidays) to the Manila calendar date of `date`.
 * Returns noon Manila of that day, so the date reads the same anywhere from UTC-4 to UTC+12.
 * @param {Date|string|number} date
 * @param {number} n
 * @returns {Date}
 */
export function addBusinessDays(date, n) {
  const d = new Date(new Date(date).getTime() + MANILA_OFFSET_MS); // UTC fields now read as Manila time
  d.setUTCHours(12, 0, 0, 0);
  for (let left = n; left > 0; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left -= 1;
  }
  return new Date(d.getTime() - MANILA_OFFSET_MS);
}

/**
 * Delivery / pickup window counted from confirmation (or from `from` = now, before confirmation).
 * @param {Date} [from]
 * @param {{ minBusinessDays: number, maxBusinessDays: number }} [days]
 * @returns {{ from: Date, to: Date }}
 */
export const etaWindow = (from = new Date(), { minBusinessDays = 3, maxBusinessDays = 5 } = {}) => ({
  from: addBusinessDays(from, minBusinessDays),
  to: addBusinessDays(from, maxBusinessDays),
});
