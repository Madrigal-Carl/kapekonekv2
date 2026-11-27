import { zodResolver } from '@hookform/resolvers/zod'
import { IconMapPin, IconX } from '@/components/ui/icons'

import { lazy, Suspense, useId, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmChangesModal, NoChangesNote } from '@/components/ui/ConfirmChangesModal'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Spinner } from '@/components/ui/Spinner'
import { useCreateAddress, useUpdateAddress } from '@/hooks/useAddresses'
import { useCan } from '@/hooks/useCan'
import { useDirtyDiff, useSaveConfirm } from '@/hooks/useDirtyDiff'
import { useBarangayPoint, usePointQuote, useReverseGeocode } from '@/hooks/useGeo'
import { useDeliveryInfo, useLocations } from '@/hooks/useSettings'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { formatPeso, formatPhone } from '@/lib/format'
import { ADDRESS_LABELS, addressSchema } from '@/schemas/address.schema'

// mapbox-gl is large: load it only when an address form opens.
const MapPicker = lazy(() => import('./MapPicker').then((m) => ({ default: m.MapPicker })))

const FIELDS = ['label', 'customLabel', 'recipientName', 'phone', 'municipality', 'barangay', 'street', 'location', 'isDefault']
const OUTSIDE = 'That spot is outside our delivery area. We deliver anywhere in Marinduque.'
// Camera zoom for the selects (PRODUCT-SPEC §8): a municipality, then closer for a barangay.
const ISLAND_FOCUS = {}
const readOnlyClasses = 'w-full rounded-control border border-sand-soft bg-cream px-3 py-2.5 text-sm text-ink-2'

const LABELS = {
  label: 'Label',
  customLabel: 'Label name',
  recipientName: 'Recipient name',
  phone: 'Contact number',
  municipality: 'Municipality',
  barangay: 'Barangay',
  street: 'Street, house number or landmark',
  location: { label: 'Map pin', format: (p) => `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` },
  isDefault: { label: 'Default address', format: (v) => (v ? 'Yes' : 'No') },
}

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
  if (!point) text = <>Drop a pin or pick your barangay to see the delivery fee.</>
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
      <IconMapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-roast" strokeWidth={2} />
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
  const barangayPoint = useBarangayPoint()
  const create = useCreateAddress()
  const update = useUpdateAddress()
  const [pinError, setPinError] = useState(null)
  const [pinNote, setPinNote] = useState(null)
  // The highlighted area. Edit opens on the saved pin with its barangay highlighted; a new address shows the whole island.
  const [focus, setFocus] = useState(() => (address ? { municipality: address.municipality, barangay: address.barangay, fit: !address.location } : ISLAND_FOCUS))

  const farmer = useCan('farms.manage') // the Farm label (server checks it too)
  const initial = useMemo(
    () => (address ? { ...emptyAddress(), ...address, customLabel: address.customLabel ?? '', phone: formatPhone(address.phone) } : emptyAddress(user)),
    [address, user],
  )
  const { register, control, handleSubmit, setValue, getValues, setError, getFieldState, formState: { errors } } = useForm({
    resolver: zodResolver(addressSchema),
    defaultValues: initial,
  })
  const changes = useDirtyDiff(initial, useWatch({ control }), LABELS)
  const unchanged = editing && changes.length === 0
  const [label, municipality, location] = useWatch({ control, name: ['label', 'municipality', 'location'] })
  const town = locations.data?.find((t) => t.name === municipality)

  /**
   * Move the pin. Moves from the municipality/barangay selects (`source: 'select'`) only place the pin: they never
   * reverse-geocode or overwrite the fields. Map click/drag, search and "Use my location" fill the fields from the pin.
   */
  const movePin = (point, source) => {
    setPinError(null)
    setPinNote(null)
    if (source === 'select') return setValue('location', point, { shouldDirty: true })
    reverse.mutate(point, {
      onSuccess: (place) => {
        if (!place.insideDeliveryArea) return setPinError(OUTSIDE)
        setValue('location', point, { shouldDirty: true })
        setValue('municipality', place.municipality, { shouldValidate: true })
        setValue('barangay', place.barangay ?? '', { shouldValidate: Boolean(place.barangay) })
        if (place.street && !getFieldState('street').isDirty) setValue('street', place.street)
        setFocus({ municipality: place.municipality, barangay: place.barangay }) // highlight where the pin landed, no camera move
      },
      onError: (error) => setPinError(errorMessage(error)),
    })
  }

  const pickMunicipality = (name) => {
    const center = locations.data.find((t) => t.name === name).center
    if (name !== municipality) setValue('barangay', '')
    movePin(center, 'select')
    setFocus({ municipality: name, fit: true })
  }

  // The pin goes to the barangay's label point (inside its polygon); no geocoding.
  const pickBarangay = async (name) => {
    const town = municipality
    const spot = await barangayPoint(town, name).catch(() => null)
    if (getValues('barangay') !== name) return // picked another one meanwhile
    if (spot) movePin(spot, 'select')
    setFocus({ municipality: town, barangay: name, fit: true })
  }

  const send = (body) => {
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
  }
  const confirm = useSaveConfirm(editing, send)
  const save = handleSubmit((values) => confirm.submit({ ...values, customLabel: values.label === 'Other' ? values.customLabel : null }))
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
        <Button variant="ghost" iconOnly aria-label="Close" onClick={onClose} className="size-10 text-ink-3 hover:bg-crema hover:text-ink-3">
          <IconX aria-hidden="true" className="size-[18px]" strokeWidth={2} />
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 overflow-y-auto px-6 py-5">
        <Suspense fallback={<div className="aspect-[600/440] min-w-0 flex-[1_1_460px] animate-pulse rounded-card bg-water" />}>
          <MapPicker value={location} onPick={movePin} focus={focus} origin={delivery.data?.pickup.location} error={pinError} busy={reverse.isPending} note={pinNote} />
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
            <div className="mt-2 flex flex-wrap gap-2">
              {ADDRESS_LABELS.filter((name) => name !== 'Farm' || farmer || label === 'Farm').map((name) => (
                <Button variant="bare"
                  key={name}
                  aria-pressed={label === name}
                  onClick={() => setValue('label', name, { shouldValidate: true })}
                  className={cn(
                    'min-h-[38px] cursor-pointer rounded-full border px-3.5 py-[7px] text-[13px] font-medium',
                    label === name ? 'border-roast bg-roast text-white' : 'border-sand-strong bg-white text-ink hover:bg-cream',
                  )}
                >
                  {name}
                </Button>
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
            <Controller
              name="municipality"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Municipality"
                  icon="pin"
                  placeholder="Select municipality"
                  searchPlaceholder="Search municipality"
                  options={locations.data.map((t) => t.name)}
                  value={field.value || null}
                  onChange={(value) => {
                    field.onChange(value)
                    pickMunicipality(value)
                  }}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  error={errors.municipality?.message}
                />
              )}
            />
            <Controller
              name="barangay"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Barangay"
                  icon="home"
                  placeholder={town ? 'Select barangay' : 'Pick a municipality first'}
                  searchPlaceholder="Search barangay"
                  options={town?.barangays ?? []}
                  value={field.value || null}
                  onChange={(value) => {
                    field.onChange(value)
                    pickBarangay(value)
                  }}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  disabled={!town}
                  error={errors.barangay?.message}
                />
              )}
            />
            <div>
              <Label htmlFor={`${id}-postal`}>Postal code</Label>
              <input id={`${id}-postal`} value={town?.postalCode ?? ''} placeholder="Fills in from municipality" readOnly className={cn(readOnlyClasses, 'mt-1.5')} />
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
        {unchanged && <NoChangesNote id={`${id}-nochange`} />}
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form={`${id}-form`} loading={saving} disabled={!locations.data || unchanged} aria-describedby={unchanged ? `${id}-nochange` : undefined}>Save address</Button>
      </div>
      <ConfirmChangesModal {...confirm.modal} changes={changes} pending={update.isPending} />
    </Modal>
  )
}
