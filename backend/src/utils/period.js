// Overview periods (PHASE-2-SPEC §3.14): calendar ranges in Asia/Manila (UTC+8, no daylight saving), weeks from Monday.
export const PERIODS = ['today', 'week', 'month', 'year'];

const OFFSET = 8 * 3600 * 1000;
const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const HOURS = ['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The Manila wall clock of an instant, read through the UTC getters. */
const wall = (date) => new Date(date.getTime() + OFFSET);
/** The instant of a Manila wall-clock time (fields may overflow, like Date.UTC). */
const at = (y, m, d, h = 0) => new Date(Date.UTC(y, m, d, h) - OFFSET);
/** "Nov 1" from an instant. */
const short = (date) => `${MONTHS[wall(date).getUTCMonth()]} ${wall(date).getUTCDate()}`;

/**
 * The current and previous calendar period around `now`, with chart buckets.
 * today: 2-hour buckets from 6 AM (earlier times count in the first, later in the last); week: days; month: weeks
 * (Week 1 = days 1–7 …); year: months.
 * @param {'today'|'week'|'month'|'year'} period
 * @param {Date} [now]
 * @returns {{ period: string, from: Date, to: Date, prevFrom: Date, prevTo: Date, labels: string[],
 *   bucketOf: (date: Date) => number, rangeText: string, prevLabel: string }}
 */
export function periodRange(period, now = new Date()) {
  const w = wall(now);
  const [y, m, d] = [w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()];
  const year = String(y);
  if (period === 'today') {
    const from = at(y, m, d);
    return {
      period, from, to: at(y, m, d + 1), prevFrom: at(y, m, d - 1), prevTo: from, labels: HOURS,
      bucketOf: (date) => Math.min(5, Math.max(0, Math.floor((wall(date).getUTCHours() - 6) / 2))),
      rangeText: `${short(from)}, ${year}`, prevLabel: 'yesterday',
    };
  }
  if (period === 'week') {
    const start = d - ((w.getUTCDay() + 6) % 7); // back to Monday
    const from = at(y, m, start);
    const to = at(y, m, start + 7);
    return {
      period, from, to, prevFrom: at(y, m, start - 7), prevTo: from, labels: WEEKDAYS,
      bucketOf: (date) => Math.floor((date - from) / DAY),
      rangeText: `${short(from)} – ${short(new Date(to - DAY))}, ${wall(new Date(to - DAY)).getUTCFullYear()}`, prevLabel: 'last week',
    };
  }
  if (period === 'year') {
    const from = at(y, 0, 1);
    return {
      period, from, to: at(y + 1, 0, 1), prevFrom: at(y - 1, 0, 1), prevTo: from, labels: MONTHS,
      bucketOf: (date) => wall(date).getUTCMonth(),
      rangeText: `Jan 1 – Dec 31, ${year}`, prevLabel: 'last year',
    };
  }
  const from = at(y, m, 1);
  const to = at(y, m + 1, 1);
  const days = wall(new Date(to - DAY)).getUTCDate();
  return {
    period: 'month', from, to, prevFrom: at(y, m - 1, 1), prevTo: from,
    labels: Array.from({ length: Math.ceil(days / 7) }, (_, i) => `Week ${i + 1}`),
    bucketOf: (date) => Math.floor((wall(date).getUTCDate() - 1) / 7),
    rangeText: `${short(from)} – ${short(new Date(to - DAY))}, ${year}`, prevLabel: MONTH_NAMES[(m + 11) % 12],
  };
}

/**
 * Sum rows into the period's buckets.
 * @param {ReturnType<typeof periodRange>} range
 * @param {Array<{ at: Date, value: number }>} rows rows inside [from, to)
 */
export function bucketize(range, rows) {
  const values = range.labels.map(() => 0);
  for (const row of rows) values[range.bucketOf(row.at)] += row.value;
  return values;
}

/**
 * This period against the previous one: `pct` is the rounded change, null when there's nothing to compare with.
 * @param {number} current
 * @param {number} previous
 */
export const compare = (current, previous) => ({ previous, pct: previous ? Math.round(((current - previous) / previous) * 100) : null });
