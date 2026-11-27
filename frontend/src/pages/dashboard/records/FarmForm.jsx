import { zodResolver } from '@hookform/resolvers/zod'
import { History } from '@/components/dashboard/History'
import { lazy, Suspense, useEffect, useId, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { ConfirmChangesModal } from '@/components/ui/ConfirmChangesModal'
import { TextField } from '@/components/dashboard/RecordParts'
import { Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Spinner } from '@/components/ui/Spinner'
import { useGroupManagers } from '@/hooks/useAssociations'
import { useFarmers } from '@/hooks/useFarmers'
import { useBarangayPoint, useReverseGeocode } from '@/hooks/useGeo'
import { useDirtyDiff, useSaveConfirm } from '@/hooks/useDirtyDiff'
import { useCreateFarm, useUpdateFarm } from '@/hooks/useRecords'
import { useLocations } from '@/hooks/useSettings'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { farmFormSchema } from '@/schemas/records.schema'
import { FormFooter } from '../farmers/FarmerForm'

// mapbox-gl is large: load it only when a farm form opens.
const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))

const FIELDS = ['farmerId', 'managedById', 'lotNumber', 'sizeHa', 'municipality', 'barangay', 'street', 'location']
const OUTSIDE = 'Put the pin on the farm, inside Marinduque.'
const HINTS = {
  empty: 'Pick the municipality and barangay to zoom in, or click the map to drop the pin.',
  placed: 'Pin placed. Drag or click the map to put it exactly on the farm.',
}
const ASSIGN_LATER = 'later'
// shortcut: the pickers load the first 50 farmers / Group Managers; add server search when an association outgrows that.
const OPTION_LIMIT = 50

const toForm = (farm) => ({
  farmerId: '',
  managedById: farm?.managedBy?.id ?? ASSIGN_LATER,
  lotNumber: farm?.lotNumber ?? '',
  sizeHa: farm?.sizeHa ?? '',
  municipality: farm?.municipality ?? '',
  barangay: farm?.barangay ?? '',
  street: farm?.street ?? '',
  location: farm?.location ?? null,
})

/**
 * Add or edit a farm (Farms.dc.html, FarmForm board). A Group Manager names the farmer first; Kaluppa sets
 * "Managed by" on its own farms. The map follows the municipality and barangay selects; a click or drag fills them.
 * @param {{ open: boolean, farm?: object | null, actsForFarmers: boolean, isKaluppa: boolean, onClose: () => void }} props
 */
export function FarmForm({ open, farm = null, actsForFarmers, isKaluppa, onClose }) {
  const formId = useId()
  const create = useCreateFarm()
  const update = useUpdateFarm()
  const [unchanged, setUnchanged] = useState(Boolean(farm))
  return (
    <Drawer
      open={open}
      width={720}
      eyebrow={isKaluppa ? 'Kaluppa farm' : 'Farm'}
      title={farm ? `Edit ${farm.propertyNumber}` : 'Add a farm'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={farm ? 'Save changes' : 'Save farm'} unchanged={unchanged} />}
    >
      {open && <FarmFields key={farm?.id ?? 'new'} formId={formId} farm={farm} create={create} update={update} actsForFarmers={actsForFarmers} isKaluppa={isKaluppa} onClose={onClose} onUnchanged={setUnchanged} />}
      {open && farm && <History entityType="farm" entityId={farm.id} />}
    </Drawer>
  )
}

function FarmFields({ formId, farm, create, update, actsForFarmers, isKaluppa, onClose, onUnchanged }) {
  const editing = Boolean(farm)
  const needsFarmer = actsForFarmers && !editing
  const locations = useLocations()
  const reverse = useReverseGeocode()
  const barangayPoint = useBarangayPoint()
  const farmers = useFarmers({ status: 'approved', limit: OPTION_LIMIT }, { enabled: needsFarmer })
  const managers = useGroupManagers({ limit: OPTION_LIMIT }, { enabled: isKaluppa })
  const [pinError, setPinError] = useState(null)
  const [pinNote, setPinNote] = useState(null)
  const [focus, setFocus] = useState(() => (farm ? { municipality: farm.municipality, barangay: farm.barangay } : {}))

  const initial = useMemo(() => toForm(farm), [farm])
  const { register, control, handleSubmit, setValue, getValues, setError, getFieldState, formState: { errors } } = useForm({
    resolver: zodResolver(farmFormSchema({ needsFarmer })),
    defaultValues: initial,
  })
  const [municipality, location] = useWatch({ control, name: ['municipality', 'location'] })
  const town = locations.data?.find((t) => t.name === municipality)

  /** Select moves only place the pin; a map click or drag reverse-geocodes and fills the fields (CLAUDE.md, Maps). */
  const movePin = (point, source) => {
    setPinError(null)
    setPinNote(null)
    if (source === 'select') return setValue('location', point, { shouldDirty: true })
    reverse.mutate(point, {
      onSuccess: (place) => {
        if (!place.insideDeliveryArea) return setPinError(OUTSIDE)
        setValue('location', point, { shouldDirty: true, shouldValidate: true })
        setValue('municipality', place.municipality, { shouldValidate: true })
        setValue('barangay', place.barangay ?? '', { shouldValidate: Boolean(place.barangay) })
        if (place.street && !getFieldState('street').isDirty) setValue('street', place.street)
        setFocus({ municipality: place.municipality, barangay: place.barangay })
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
  const pickBarangay = async (name) => {
    const town = getValues('municipality')
    const spot = await barangayPoint(town, name).catch(() => null)
    if (getValues('barangay') !== name) return // picked another one meanwhile
    if (spot) movePin(spot, 'select')
    setFocus({ municipality: town, barangay: name, fit: true })
  }

  const managerOptions = [
    { value: ASSIGN_LATER, label: 'Assign later' },
    ...(managers.data?.items ?? []).map((m) => ({ value: m.id, label: `${m.name} · ${m.association?.name ?? 'no association'}` })),
  ]
  const managerName = (id) => (id === farm?.managedBy?.id ? farm.managedBy.name : managerOptions.find((o) => o.value === id)?.label.split(' · ')[0] ?? 'Assign later')
  const changes = useDirtyDiff(initial, useWatch({ control }), {
    ...(isKaluppa && { managedById: { label: 'Managed by', format: managerName } }),
    lotNumber: 'Lot number',
    sizeHa: { label: 'Size', format: (v) => `${Number(v).toFixed(2)} ha` },
    municipality: 'Municipality',
    barangay: 'Barangay',
    street: 'Street, sitio or landmark',
    location: { label: 'Pin location', format: (p) => `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` },
  })
  useEffect(() => onUnchanged(editing && changes.length === 0), [editing, changes.length, onUnchanged])

  const send = (body) => {
    const onError = (error) => {
      if (error.response?.data?.errors?.location) setPinError(error.response.data.errors.location)
      if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
    }
    if (editing) {
      return update.mutate({ id: farm.id, ...body }, { onSuccess: () => (toast.success('Farm updated.'), onClose()), onError })
    }
    create.mutate(body, { onSuccess: (saved) => (toast.success(`Farm saved as ${saved.propertyNumber}.`), onClose()), onError })
  }
  const confirm = useSaveConfirm(editing, send)
  const save = handleSubmit(({ farmerId, managedById, ...values }) =>
    confirm.submit({
      ...values,
      ...(needsFarmer && { farmerId }),
      ...(isKaluppa && { managedById: managedById === ASSIGN_LATER ? null : managedById }),
    }),
  )
  if (!locations.data) {
    return (
      <div className="grid min-h-60 place-items-center">
        <Spinner className="size-6 text-roast" />
      </div>
    )
  }
  return (
    <form id={formId} noValidate onSubmit={save} className="contents">
      <ConfirmChangesModal {...confirm.modal} changes={changes} pending={update.isPending} />
      {needsFarmer && (
        <Controller
          name="farmerId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Farmer"
              icon="home"
              placeholder="Select the farmer who owns it"
              searchPlaceholder="Search farmer"
              options={(farmers.data?.items ?? []).map((f) => ({ value: f.id, label: f.name }))}
              value={field.value || null}
              onChange={field.onChange}
              ref={field.ref}
              error={errors.farmerId?.message}
            />
          )}
        />
      )}
      {isKaluppa && (
        <Controller
          name="managedById"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Managed by (Group Manager)"
              icon="home"
              placeholder="Assign later"
              searchPlaceholder="Search managed by (group manager)"
              options={managerOptions}
              value={field.value}
              onChange={field.onChange}
              ref={field.ref}
              error={errors.managedById?.message}
            />
          )}
        />
      )}
      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <TextField id="farm-lot" label="Lot number" placeholder="e.g. Lot 12-B" autoComplete="off" error={errors.lotNumber?.message} {...register('lotNumber')} />
        <div>
          <Label htmlFor="farm-pn">Property number</Label>
          <input
            id="farm-pn"
            readOnly
            value={farm?.propertyNumber ?? ''}
            placeholder="TCT-····-····"
            aria-describedby="farm-pn-hint"
            className="mt-2 min-h-[42px] w-full rounded-control border border-sand-soft bg-cream px-3 py-[9px] font-mono text-sm text-ink-2"
          />
          <span id="farm-pn-hint" className="mt-[5px] block text-xs text-ink-3">Made automatically when you save.</span>
        </div>
      </div>
      <TextField
        id="farm-size"
        label="Size (hectares)"
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder="0.0"
        error={errors.sizeHa?.message}
        {...register('sizeHa', { setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)) })}
      />
      <div className="grid gap-5 min-[720px]:grid-cols-2">
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
              disabled={!town}
              ref={field.ref}
              error={errors.barangay?.message}
            />
          )}
        />
      </div>
      <TextField id="farm-street" label="Street, sitio or landmark" optional placeholder="e.g. Sitio Ilaya, near the chapel" error={errors.street?.message} {...register('street')} />
      <div>
        <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Farm location</span>
        <div className="mt-2">
          <Suspense fallback={<div className="aspect-[600/440] animate-pulse rounded-card bg-water" />}>
            <MapPicker
              value={location}
              onPick={movePin}
              focus={focus}
              error={pinError ?? errors.location?.message}
              busy={reverse.isPending}
              note={pinNote}
              pinLabel="Farm pin"
              ariaLabel="Farm map. Click to place the farm pin."
              searchable={false}
              hints={HINTS}
            />
          </Suspense>
        </div>
      </div>
    </form>
  )
}
