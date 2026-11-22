import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'

/** Avatar colour per role (PostDetail.dc.html). */
const ROLE_BG = { kaluppa: 'bg-roast', group_manager: 'bg-manager', farmer: 'bg-caramel-ink', buyer: 'bg-roast' }

/** Round initials avatar (or photo) for an author card `{ initials, role, avatarUrl }`. */
export function Avatar({ person, className, bg }) {
  return (
    <span className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-white', bg ?? ROLE_BG[person.role] ?? 'bg-ink-2', className)}>
      {person.avatarUrl ? <img src={imageUrl(person.avatarUrl, 48)} alt="" className="size-full object-cover" /> : person.initials}
    </span>
  )
}

const BADGE = {
  kaluppa: 'bg-espresso text-crema',
  group_manager: 'bg-manager-tint text-manager-ink',
  farmer: 'bg-caramel-tint text-caramel-badge',
}

/** Uppercase role badge next to an author's name. */
export function RoleBadge({ person, className }) {
  if (!person.roleLabel) return null
  return (
    <span className={cn('rounded-full px-[7px] py-px text-[10px] font-semibold uppercase tracking-[0.08em]', BADGE[person.role] ?? BADGE.farmer, className)}>
      {person.roleLabel}
    </span>
  )
}
