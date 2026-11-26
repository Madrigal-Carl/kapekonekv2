import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { avatarColor, avatarShape, chatAvatarId } from './chatText'

/**
 * An Inbox avatar (Inbox.dc.html): the profile photo when there is one (cover, never stretched), else initials on the
 * person's colour. `shape` is round for people, 12px for groups and the Kaluppa chat.
 * @param {{ initials: string, colorId: string, avatarUrl?: string|null, shape?: string, px: number, className?: string }} props
 */
export function InboxAvatar({ initials, colorId, avatarUrl, shape = 'rounded-full', px, className }) {
  return (
    <span aria-hidden="true" className={cn('grid shrink-0 place-items-center overflow-hidden font-semibold text-white', shape, !avatarUrl && avatarColor(colorId), className)}>
      {avatarUrl ? <img src={imageUrl(avatarUrl, px * 2)} alt="" className="size-full object-cover" /> : initials}
    </span>
  )
}

/** A chat's avatar in the list and the thread header. */
export const ChatAvatar = ({ chat, px, className }) => (
  <InboxAvatar initials={chat.initials} colorId={chatAvatarId(chat)} avatarUrl={chat.avatarUrl} shape={avatarShape(chat)} px={px} className={className} />
)
