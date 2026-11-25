import { Button } from '@/components/ui/Button'
import { IconBriefcase, IconFarm, IconHome, IconMapPin } from '@/components/ui/icons'
import { addressArea, addressLabel } from '@/lib/address'
import { cn } from '@/lib/cn'
import { formatPhone } from '@/lib/format'

export const ADDRESS_ICONS = { Home: IconHome, Work: IconBriefcase, Farm: IconFarm, Other: IconMapPin }
const action = 'h-10 px-3 text-[13px] hover:bg-crema'

/** Saved address on /addresses (Addresses.dc.html): label, Default badge, recipient, street, area, pin status, actions. */
export function AddressCard({ address, onEdit, onMakeDefault, onDelete, busy }) {
  const Icon = ADDRESS_ICONS[address.label]
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
          <Button variant="ghost" onClick={onEdit} className={action} aria-label={`Edit ${label} address`}>
            Edit
          </Button>
          {!address.isDefault && (
            <Button variant="ghost" onClick={onMakeDefault} disabled={busy} className={action}>
              Set as default
            </Button>
          )}
          <Button variant="ghost" onClick={onDelete} className={cn(action, 'text-danger-ink hover:text-danger-ink')} aria-label={`Delete ${label} address`}>
            Delete
          </Button>
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
