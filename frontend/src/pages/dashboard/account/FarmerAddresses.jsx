import { lazy, Suspense, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ADDRESS_ICONS } from '@/components/map/AddressCard'
import { AddressFormModal } from '@/components/map/AddressFormModal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { IconEdit, IconMapPinOff, IconPlus, IconRoute, IconTag, IconTrash, IconTriangleAlert } from '@/components/ui/icons'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAddressErrorToast, useAddresses, useDeleteAddress, useSetDefaultAddress } from '@/hooks/useAddresses'
import { useAuth } from '@/hooks/useAuth'
import { addressArea, addressLabel, quoteErrorText } from '@/lib/address'
import { cn } from '@/lib/cn'
import { formatPesoShort, formatPhone } from '@/lib/format'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))
const MAX_ADDRESSES = 10
const GRID = 'grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(min(520px,100%),1fr))]'
const MAP_SLOT = 'relative min-h-[161px] flex-[0_0_220px] bg-water max-sm:basis-full'

/** Farmer address book (FarmerAddresses.dc.html): map cards, default first, plus an "Add a new address" tile. */
export function FarmerAddresses() {
  const { user } = useAuth()
  const addresses = useAddresses()
  const setDefault = useSetDefaultAddress()
  const remove = useDeleteAddress()
  const addressError = useAddressErrorToast()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const list = addresses.data ?? []
  const adding = params.get('add') === '1'
  const add = () => setParams({ add: '1' })
  const closeForm = () => {
    setEditing(null)
    if (adding) setParams({}, { replace: true })
  }

  const makeDefault = (address) =>
    setDefault.mutate(address._id, {
      onSuccess: () => toast.success(`${addressLabel(address)} is now your default address.`),
      onError: (e) => addressError(e),
    })
  const confirmDelete = () =>
    remove.mutate(deleting._id, {
      onSuccess: () => {
        toast.success('Address deleted.')
        setDeleting(null)
      },
      onError: (error) => addressError(error),
    })

  if (addresses.isPending) {
    return (
      <div aria-busy="true" className={GRID}>
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-card" />)}
      </div>
    )
  }
  if (addresses.isError) {
    return (
      <EmptyState icon={IconTriangleAlert} tone="error" title="We couldn’t load your addresses" action={<Button variant="outline" onClick={() => addresses.refetch()}>Try again</Button>} className="bg-white">
        Check your connection and try again.
      </EmptyState>
    )
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13.5px] text-ink-2"><strong>{list.length} of {MAX_ADDRESSES}</strong> addresses saved</span>
        <span className="text-[12.5px] text-ink-3">From the Kaluppa branch in Pantayin · fees are by road distance</span>
      </div>
      <div className={GRID}>
        {list.map((address) => (
          <AddressMapCard
            key={address._id}
            address={address}
            busy={setDefault.isPending}
            onEdit={() => setEditing(address)}
            onMakeDefault={() => makeDefault(address)}
            onDelete={() => setDeleting(address)}
          />
        ))}
        {list.length < MAX_ADDRESSES && (
          <Button
            variant="bare"
            onClick={add}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-sand-strong bg-cream p-5 text-center text-ink-2 hover:bg-crema"
          >
            <span aria-hidden="true" className="grid size-11 place-items-center rounded-full border border-sand bg-white text-roast">
              <IconPlus className="size-5" strokeWidth={2} />
            </span>
            <strong className="text-sm text-ink">Add a new address</strong>
            <span className="text-[12.5px]">Pick your municipality and barangay, then drop a pin.</span>
          </Button>
        )}
      </div>

      {(adding || editing) && <AddressFormModal address={editing} user={user} onClose={closeForm} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={remove.isPending}
        icon={IconTrash}
        tone="danger"
        title="Delete this address?"
        description={deleting && `${addressLabel(deleting)} · ${addressArea(deleting)} will be removed.${deleting.isDefault ? ' Your newest other address becomes the default.' : ''}`}
        cancelLabel="Keep it"
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </>
  )
}

function AddressMapCard({ address, busy, onEdit, onMakeDefault, onDelete }) {
  const label = addressLabel(address)
  const Icon = address.label === 'Other' ? IconTag : ADDRESS_ICONS[address.label]
  const id = `ad-${address._id}`
  return (
    <article aria-labelledby={id} className={cn('flex flex-wrap overflow-hidden rounded-card bg-white', address.isDefault ? 'border-2 border-roast' : 'border border-sand')}>
      <div className={MAP_SLOT}>
        {address.location ? (
          <AddressMap address={address} />
        ) : (
          <div className="flex h-full min-h-[161px] flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,var(--color-crema)_0_10px,var(--color-cream)_10px_20px)] p-4 text-center">
            <IconMapPinOff aria-hidden="true" className="size-6 text-caramel-badge" strokeWidth={1.75} />
            <span className="text-[12.5px] font-semibold text-ink-2">No pin yet</span>
            <Button variant="link" onClick={onEdit} className="h-auto text-[12.5px]">Drop a pin</Button>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-2.5 px-5 py-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-crema px-2.5 py-[3px] text-xs font-semibold text-tone-roast-ink">
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
            {label}
          </span>
          {address.isDefault && <span className="rounded-full bg-espresso px-2.5 py-[3px] text-[11.5px] font-semibold text-crema">Default</span>}
        </div>
        <div>
          <h2 id={id} className="text-[15px] font-semibold">
            {address.recipientName} <span className="font-normal text-ink-3">· {formatPhone(address.phone)}</span>
          </h2>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-ink-2">
            {address.street}
            <br />
            {addressArea(address)}
          </p>
        </div>
        <span className={cn('inline-flex items-center gap-1.5 text-[12.5px]', address.pinned && address.quote ? 'text-ink-2' : 'text-notice-ink')}>
          <IconRoute aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          {feeText(address)}
        </span>
        <div className="mt-auto flex flex-wrap gap-1.5 border-t border-sand-soft pt-2.5">
          <Button variant="outline" size="sm" onClick={onEdit} leftIcon={<IconEdit aria-hidden="true" className="size-3.5" strokeWidth={2} />} aria-label={`Edit ${label} address`} className="gap-1.5">
            Edit
          </Button>
          {!address.isDefault && (
            <Button variant="soft" size="sm" onClick={onMakeDefault} disabled={busy}>
              Set as default
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDelete} leftIcon={<IconTrash aria-hidden="true" className="size-3.5" strokeWidth={2} />} aria-label={`Delete ${label} address`} className="ml-auto gap-1.5 px-2.5 text-danger-ink">
            Delete
          </Button>
        </div>
      </div>
    </article>
  )
}

const feeText = (address) => {
  if (!address.pinned) return 'No pin yet · the fee is estimated at checkout'
  if (address.quote) return `${address.quote.distanceKm} km from Kaluppa · ${formatPesoShort(address.quote.feeCentavos)} delivery`
  return quoteErrorText(address.quoteError)
}

/** A still map of the pin with its barangay highlighted, fitted once. */
function AddressMap({ address }) {
  const { municipality, barangay, location } = address
  const focus = useMemo(() => ({ municipality, barangay, fit: true }), [municipality, barangay])
  return (
    <div className="absolute inset-0" role="img" aria-label={`Map of the pin in ${barangay}, ${municipality}`}>
      <Suspense fallback={<Skeleton className="size-full rounded-none" />}>
        <MapPicker preview value={location} focus={focus} />
      </Suspense>
    </div>
  )
}
