import { IconBriefcase, IconHome, IconMapPin } from '@/components/ui/icons'
import { addressArea, addressLabel } from '@/lib/address'
import { cn } from '@/lib/cn'
import { formatPhone } from '@/lib/format'

const ICONS = { Home: IconHome, Work: IconBriefcase, Other: IconMapPin }
const action = 'inline-flex min-h-10 cursor-pointer items-center rounded-control border-0 bg-transparent px-3 py-2 text-[13px] font-semibold hover:bg-crema'

/** Saved address on /addresses (Addresses.dc.html): label, Default badge, recipient, street, area, pin status, actions. */
export function AddressCard({ address, onEdit, onMakeDefault, onDelete, busy }) {
  const Icon = ICONS[address.label]
  const label = addressLabel(address)
  return (
    <li className={cn('overflow-hidden rounded-card bg-white', address.isDefault ? 'border-2 border-roast' : 'border border-sand')}>
      <div className="flex flex-wrap items-start gap-[18px] px-5 py-[18px]">
        <span className="grid size-11 shrink-0 place-items-center rounded-card bg-crema text-roast">
          <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-[1_1_360px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{label}</span>
            {address.isDefault && <DefaultBadge />}
          </div>
          <p className="mt-1.5 text-sm">
            <strong className="font-semibold">{address.recipientName}</strong>
            <span className="text-ink-3"> · {formatPhone(address.phone)}</span>
          </p>
          <p className="mt-0.5 text-[13.5px] leading-[1.55] text-ink-2">{address.street}</p>
          <p className="text-[13.5px] leading-[1.55] text-ink-2">{addressArea(address)}</p>
          <p className={cn('mt-2 inline-flex items-center gap-1.5 text-xs', address.pinned ? 'text-success-ink' : 'text-caramel-badge')}>
            <IconMapPin aria-hidden="true" className="size-[13px]" strokeWidth={2} />
            {address.pinned ? 'Pinned on map' : 'No pin yet · add one for a more accurate delivery fee'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={onEdit} className={cn(action, 'text-roast')} aria-label={`Edit ${label} address`}>
            Edit
          </button>
          {!address.isDefault && (
            <button type="button" onClick={onMakeDefault} disabled={busy} className={cn(action, 'text-roast disabled:opacity-60')}>
              Set as default
            </button>
          )}
          <button type="button" onClick={onDelete} className={cn(action, 'text-danger-ink')} aria-label={`Delete ${label} address`}>
            Delete
          </button>
        </div>
      </div>
    </li>
  )
}

export function DefaultBadge() {
  return <span className="rounded-[4px] bg-roast px-[7px] py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-white">Default</span>
}

/** Outlined label chip ("Home") on checkout and order pages. */
export function LabelChip({ children }) {
  return <span className="rounded-[4px] border border-sand-strong px-[7px] py-px text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-2">{children}</span>
}
