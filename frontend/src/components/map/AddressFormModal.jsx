import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, X } from 'lucide-react'
import { lazy, Suspense, useId, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { FieldHint, Input, inputClasses, Label } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useCreateAddress, useUpdateAddress } from '@/hooks/useAddresses'
import { usePointQuote, useReverseGeocode } from '@/hooks/useGeo'
import { useDeliveryInfo, useLocations } from '@/hooks/useSettings'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatPeso, formatPhone } from '@/lib/format'
import { ADDRESS_LABELS, addressSchema } from '@/schemas/address.schema'

// mapbox-gl is large: load it only when an address form opens.
const MapPicker = lazy(() => import('./MapPicker').then((m) => ({ default: m.MapPicker })))

const FIELDS = ['label', 'customLabel', 'recipientName', 'phone', 'municipality', 'barangay', 'street', 'location', 'isDefault']
const OUTSIDE = 'That spot is outside our delivery area. We deliver anywhere in Marinduque.'
const readOnlyClasses = 'w-full rounded-control border border-sand-soft bg-cream px-3 py-2.5 text-sm text-ink-2'

const emptyAddress = (user) => ({
  label: 'Home',
  customLabel: '',
  recipientName: user ? `${user.firstName} ${user.lastName}`.trim() : '',
  phone: formatPhone(user?.contactNumber ?? ''),
  municipality: '',
  barangay: '',
  street: '',
  location: null,
  isDefault: false,
})

function FeePreview({ point }) {
  const quote = usePointQuote(point)
  let text
  if (!point) text = <>Drop a pin for a delivery fee estimate. The exact fee is confirmed at checkout.</>
  else if (quote.isPending) text = <>Working out the delivery fee…</>
  else if (quote.isError) text = <>{errorMessage(quote.error)}</>
  else {
    text = (
      <>
        About <strong>{quote.data.distanceKm} km</strong> by road from Kaluppa · delivery fee <strong>{formatPeso(quote.data.feeCentavos)}</strong>. The exact fee is confirmed at checkout.
      </>
    )
  }
  return (
    <div aria-live="polite" className="flex items-start gap-2.5 rounded-[6px] bg-crema px-3.5 py-3 text-[13px] text-ink-2">
      <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />
      <span>{text}</span>
    </div>
  )
}

/**
 * Add or edit a delivery address (AddressModal.dc.html): map on the left, form on the right.
 * Mount it only while open (`{open && <AddressFormModal …/>}`) so each opening starts fresh.
 * @param {{ address?: object|null, user?: object, onClose: () => void, onSaved?: (address: object) => void }} props
 */
export function AddressFormModal({ address, user, onClose, onSaved }) {
  const id = useId()
  const editing = Boolean(address)
  const locations = useLocations()
  const delivery = useDeliveryInfo()
  const reverse = useReverseGeocode()
  const create = useCreateAddress()
  const update = useUpdateAddress()
  const [pinError, setPinError] = useState(null)

  const { register, control, handleSubmit, setValue, setError, getFieldState, formState: { errors } } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: address
      ? { ...emptyAddress(), ...address, customLabel: address.customLabel ?? '', phone: formatPhone(address.phone) }
      : emptyAddress(user),
  })
  const [label, municipality, location] = useWatch({ control, name: ['label', 'municipality', 'location'] })
  const town = locations.data?.find((t) => t.name === municipality)

  const dropPin = (point) => {
    setPinError(null)
    reverse.mutate(point, {
      onSuccess: (place) => {
        if (!place.insideDeliveryArea) return setPinError(OUTSIDE)
        setValue('location', point, { shouldDirty: true })
        setValue('municipality', place.municipality, { shouldValidate: true })
        setValue('barangay', place.barangay ?? '', { shouldValidate: Boolean(place.barangay) })
        if (place.street && !getFieldState('street').isDirty) setValue('street', place.street)
      },
      onError: (error) => setPinError(errorMessage(error)),
    })
  }

  const save = handleSubmit((values) => {
    const body = { ...values, customLabel: values.label === 'Other' ? values.customLabel : null }
    const mutation = editing ? update : create
    mutation.mutate(editing ? { id: address._id, ...body } : body, {
      onSuccess: (saved) => {
        toast.success(editing ? 'Address updated' : 'Address saved')
        onSaved?.(saved)
        onClose()
      },
      onError: (error) => {
        if (error.response?.data?.errors?.location) setPinError(error.response.data.errors.location)
        if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
      },
    })
  })
  const saving = create.isPending || update.isPending

  return (
    <Modal open onClose={onClose} labelledBy={`${id}-title`} className="flex max-h-[calc(100dvh-2rem)] max-w-[1080px] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-sand-soft px-6 py-[18px]">
        <div>
          <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-3">Delivery address</span>
          <h2 id={`${id}-title`} className="mt-0.5 text-[19px] font-semibold">
            {editing ? 'Edit address' : 'Add new address'}
          </h2>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 cursor-pointer place-items-center rounded-control border-0 bg-transparent text-ink-3 hover:bg-crema">
          <X aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-wrap gap-6 overflow-y-auto px-6 py-5">
        <Suspense fallback={<div className="aspect-[600/440] min-w-0 flex-[1_1_460px] animate-pulse rounded-card bg-water" />}>
          <MapPicker value={location} onPick={dropPin} origin={delivery.data?.pickup.location} error={pinError} busy={reverse.isPending} />
        </Suspense>

        {/* The selects must mount with their options so the saved municipality and barangay stay selected. */}
        {!locations.data ? (
          <div className="grid min-h-60 flex-[1_1_380px] place-items-center">
            <Spinner className="size-6 text-roast" />
          </div>
        ) : (
        <form id={`${id}-form`} onSubmit={save} noValidate className="flex min-w-0 flex-[1_1_380px] flex-col gap-3.5">
          <fieldset className="m-0 border-0 p-0">
            <legend className="p-0 text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Label</legend>
            <div className="mt-2 flex gap-2">
              {ADDRESS_LABELS.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={label === name}
                  onClick={() => setValue('label', name, { shouldValidate: true })}
                  className={cn(
                    'min-h-[38px] cursor-pointer rounded-full border px-3.5 py-[7px] text-[13px] font-medium',
                    label === name ? 'border-roast bg-roast text-white' : 'border-sand-strong bg-white text-ink hover:bg-cream',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
          {label === 'Other' && (
            <div>
              <Label htmlFor={`${id}-custom`}>Label name</Label>
              <Input id={`${id}-custom`} className="mt-1.5 py-2.5" placeholder="e.g. Mama’s house" invalid={Boolean(errors.customLabel)} aria-describedby={`${id}-custom-hint`} {...register('customLabel')} />
              <FieldHint id={`${id}-custom-hint`} error={errors.customLabel?.message} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-name`}>Recipient name</Label>
              <Input id={`${id}-name`} className="mt-1.5 py-2.5" autoComplete="name" invalid={Boolean(errors.recipientName)} aria-describedby={`${id}-name-hint`} {...register('recipientName')} />
              <FieldHint id={`${id}-name-hint`} error={errors.recipientName?.message} />
            </div>
            <div>
              <Label htmlFor={`${id}-phone`}>Phone</Label>
              <Input id={`${id}-phone`} className="mt-1.5 py-2.5" inputMode="tel" autoComplete="tel" invalid={Boolean(errors.phone)} aria-describedby={`${id}-phone-hint`} {...register('phone')} />
              <FieldHint id={`${id}-phone-hint`} error={errors.phone?.message} />
            </div>
            <div>
              <Label htmlFor={`${id}-province`}>Province</Label>
              <input id={`${id}-province`} value="Marinduque" readOnly className={cn(readOnlyClasses, 'mt-1.5')} />
            </div>
            <div>
              <Label htmlFor={`${id}-town`}>Municipality</Label>
              <select
                id={`${id}-town`}
                className={cn(inputClasses, 'mt-1.5 py-2.5')}
                aria-invalid={Boolean(errors.municipality) || undefined}
                aria-describedby={`${id}-town-hint`}
                {...register('municipality', { onChange: () => setValue('barangay', '') })}
              >
                <option value="">Choose…</option>
                {locations.data?.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
              <FieldHint id={`${id}-town-hint`} error={errors.municipality?.message} />
            </div>
            <div>
              <Label htmlFor={`${id}-brgy`}>Barangay</Label>
              <select
                id={`${id}-brgy`}
                className={cn(inputClasses, 'mt-1.5 py-2.5')}
                disabled={!town}
                aria-invalid={Boolean(errors.barangay) || undefined}
                aria-describedby={`${id}-brgy-hint`}
                {...register('barangay')}
              >
                <option value="">{town ? 'Choose…' : 'Choose a municipality first'}</option>
                {town?.barangays.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <FieldHint id={`${id}-brgy-hint`} error={errors.barangay?.message} />
            </div>
            <div>
              <Label htmlFor={`${id}-postal`}>Postal code</Label>
              <input id={`${id}-postal`} value={town?.postalCode ?? ''} readOnly className={cn(readOnlyClasses, 'mt-1.5')} />
            </div>
          </div>

          <div>
            <Label htmlFor={`${id}-street`}>Street, house no., landmark</Label>
            <Input
              id={`${id}-street`}
              className="mt-1.5 py-2.5"
              placeholder="e.g. Lot 12, Purok 3, near the chapel"
              invalid={Boolean(errors.street)}
              aria-describedby={`${id}-street-hint`}
              {...register('street')}
            />
            <FieldHint id={`${id}-street-hint`} error={errors.street?.message} />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" className="size-[18px] accent-roast" {...register('isDefault')} />
            Set as default address
          </label>

          <FeePreview point={location} />
        </form>
        )}
      </div>

      <div className="flex justify-end gap-2.5 border-t border-sand-soft bg-cream px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form={`${id}-form`} pending={saving} disabled={!locations.data}>Save address</Button>
      </div>
    </Modal>
  )
}
