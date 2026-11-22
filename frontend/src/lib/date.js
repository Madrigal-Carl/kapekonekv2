import { format, formatDistanceToNowStrict, isYesterday } from 'date-fns'

/** "Nov 14, 2026" */
export const formatDate = (value) => format(new Date(value), 'MMM d, yyyy')

/** "Nov 21, 2026 · 9:05 AM" */
export const formatDateTime = (value) => format(new Date(value), "MMM d, yyyy '·' h:mm a")

/** "Just now", "2 hours ago", "Yesterday", "3 days ago", then the date after a week. */
export function timeAgo(value, now = new Date()) {
  const date = new Date(value)
  const minutes = (now - date) / 60_000
  if (minutes < 1) return 'Just now'
  if (minutes < 24 * 60) return formatDistanceToNowStrict(date, { addSuffix: true })
  if (isYesterday(date)) return 'Yesterday'
  if (minutes < 7 * 24 * 60) return formatDistanceToNowStrict(date, { addSuffix: true, unit: 'day' })
  return formatDate(date)
}

const manilaHour = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Manila' })
const manilaDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })

/** "Good morning" before noon, "Good afternoon" until 6 PM, then "Good evening" (Manila time). */
export function greeting(now = new Date()) {
  const hour = Number(manilaHour.format(now))
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

/** "Monday, Nov 23" in Manila. */
export const todayInManila = (now = new Date()) => manilaDay.format(now)
