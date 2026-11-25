import { IconMapPin, IconPlus, IconTrash, IconTriangleAlert } from '@/components/ui/icons'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddressCard } from '@/components/map/AddressCard'
import { AddressFormModal } from '@/components/map/AddressFormModal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAddresses, useDeleteAddress, useSetDefaultAddress } from '@/hooks/useAddresses'
import { useAuth } from '@/hooks/useAuth'
import { AccountHeading } from '@/layouts/AccountLayout'
import { addressLabel } from '@/lib/address'
import { errorMessage } from '@/lib/applyServerErrors'

const MAX_ADDRESSES = 10

/** /addresses (Addresses.dc.html). */
/** Address book. `embedded`: inside the dashboard's Account settings tabs, which bring their own header and width. */
export function Addresses({ embedded = false }) {
  const { user } = useAuth()
  const addresses = useAddresses()
  const setDefault = useSetDefaultAddress()
  const remove = useDeleteAddress()
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, object = edit
  const [deleting, setDeleting] = useState(null)
  const list = addresses.data ?? []
  const full = list.length >= MAX_ADDRESSES

  const confirmDelete = () =>
    remove.mutate(deleting._id, {
      onSuccess: () => {
        toast.success('Address deleted')
        setDeleting(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })

  return (
    <>
      <div className={embedded ? 'flex justify-end' : 'mx-auto flex max-w-[1080px] flex-wrap items-end justify-between gap-4 px-4 pt-9 sm:px-8'}>
        {!embedded && (
          <AccountHeading eyebrow="Account" title="Addresses">
            Where we deliver your orders. We deliver anywhere in Marinduque.
          </AccountHeading>
        )}
        <Button onClick={() => setEditing(null)} disabled={full || addresses.isPending} className="px-[18px] py-3 font-semibold">
          <IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />
          Add new address
        </Button>
      </div>
      <div className={embedded ? 'pt-4' : 'mx-auto max-w-[1080px] px-4 pb-20 pt-6 sm:px-8'}>
        {addresses.isPending ? (
          <ul aria-busy="true" className="m-0 flex list-none flex-col gap-3.5 p-0">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex gap-[18px] rounded-card border border-sand-soft bg-white px-5 py-[18px]">
                <Skeleton className="size-11 rounded-card" />
                <div className="flex flex-1 flex-col gap-2.5">
                  <Skeleton className="h-3.5 w-1/4" />
                  <Skeleton className="h-2.5 w-2/3" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </li>
            ))}
          </ul>
        ) : addresses.isError ? (
          <EmptyState
            icon={IconTriangleAlert}
            tone="error"
            title="We couldn’t load your addresses"
            action={<Button variant="outline" onClick={() => addresses.refetch()}>Try again</Button>}
            className="bg-white"
          >
            Check your connection and try again.
          </EmptyState>
        ) : list.length === 0 ? (
          <EmptyState icon={IconMapPin} title="No saved addresses yet" action={<Button onClick={() => setEditing(null)}>Add new address</Button>} className="bg-white">
            Add one to get your coffee delivered anywhere in Marinduque.
          </EmptyState>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
            {list.map((address) => (
              <AddressCard
                key={address._id}
                address={address}
                busy={setDefault.isPending}
                onEdit={() => setEditing(address)}
                onMakeDefault={() => setDefault.mutate(address._id, { onError: (e) => toast.error(errorMessage(e)) })}
                onDelete={() => setDeleting(address)}
              />
            ))}
          </ul>
        )}
        <p className="mt-[18px] text-[12.5px] text-ink-3">
          You can save up to 10 addresses. Deleting asks you to confirm. The default address is pre-selected at checkout.
        </p>
      </div>

      {editing !== undefined && <AddressFormModal address={editing} user={user} onClose={() => setEditing(undefined)} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        pending={remove.isPending}
        icon={IconTrash}
        tone="danger"
        title="Delete this address?"
        description={deleting && `${addressLabel(deleting)} (${deleting.street}, ${deleting.barangay}) will be removed.${deleting.isDefault ? ' Your newest other address becomes the default.' : ''}`}
        cancelLabel="Keep it"
        confirmLabel="Delete"
        confirmVariant="danger"
      />
    </>
  )
}
