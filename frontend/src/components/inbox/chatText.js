import { differenceInCalendarDays, format } from 'date-fns'

// Inbox wording and avatars (Inbox.dc.html, InboxMobile.dc.html).

/** "9:12 AM" today, "Yesterday", "Mon" this week, else "Mar 2". */
export function listTime(value, now = new Date()) {
  const d = new Date(value)
  const days = differenceInCalendarDays(now, d)
  if (days === 0) return format(d, 'h:mm a')
  if (days === 1) return 'Yesterday'
  if (days < 7) return format(d, 'EEE')
  return format(d, 'MMM d')
}

/** Day separator: "Today", "Yesterday", "Mon, Nov 24". */
export function dayLabel(value, now = new Date()) {
  const days = differenceInCalendarDays(now, new Date(value))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return format(new Date(value), 'EEE, MMM d')
}

/** The chat list's second line: "You: …", "Liza: …" in groups and Kaluppa chats, the plain text in direct chats. */
export function previewLine(chat) {
  const m = chat.lastMessage
  if (!m) return 'No messages yet'
  if (m.mine) return `You: ${m.text}`
  return chat.type === 'direct' || !m.senderName ? m.text : `${m.senderName}: ${m.text}`
}

/** The note that replaces the composer in a read-only chat. */
export function readOnlyNote(chat) {
  const day = chat.leftAt ? format(new Date(chat.leftAt), 'MMM d') : null
  if (chat.type === 'group') return `You left ${chat.name}${day ? ` on ${day}` : ''}. This chat is read-only; its history stays here.`
  return `This chat became read-only${day ? ` on ${day}` : ''}. Its history stays here.`
}

/** "Nestor is typing…", "Nestor and Lorna are typing…" */
export const typingLine = (names) => (names.length === 1 ? `${names[0]} is typing…` : `${names.slice(0, -1).join(', ')} and ${names.at(-1)} are typing…`)

const AVATARS = ['bg-caramel-ink', 'bg-ink-2', 'bg-avatar-green', 'bg-roast']
/** A steady avatar colour per person or chat; the Kaluppa team is always espresso. */
export function avatarColor(id = '') {
  if (id === 'kaluppa') return 'bg-espresso'
  let h = 0
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATARS[h % AVATARS.length]
}

/** The id that picks a chat's avatar colour: the Kaluppa team, the group, or the other person. */
export function chatAvatarId(chat) {
  if (chat.type === 'kaluppa' && chat.initials === 'K' && chat.name === 'Kaluppa') return 'kaluppa'
  return chat.type === 'group' ? chat.id : (chat.members[0]?.id ?? chat.id)
}

/** Groups and the Kaluppa team use a rounded square, people a circle. */
export const avatarShape = (chat) => (chat.type === 'group' || chatAvatarId(chat) === 'kaluppa' ? 'rounded-[12px]' : 'rounded-full')
