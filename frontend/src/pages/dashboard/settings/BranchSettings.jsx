import { zodResolver } from '@hookform/resolvers/zod'
import { lazy, Suspense, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { TextField } from '@/components/dashboard/RecordParts'
import { Input } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Switch } from '@/components/ui/Switch'
import { useSaveAdminSetting } from '@/hooks/useAdminSettings'
import { useBarangayPoint, useReverseGeocode } from '@/hooks/useGeo'
import { useLocations } from '@/hooks/useSettings'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { formatPhone } from '@/lib/format'
import { branchFormSchema } from '@/schemas/setting.schema'
import { SaveBar, SettingsCard } from './SettingsParts'

const MapPicker = lazy(() => import('@/components/map/MapPicker').then((m) => ({ default: m.MapPicker })))
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const FORM_ID = 'settings-branch'
const toForm = (b) => ({ ...b, phone: formatPhone(b.phone), street: b.street ?? '' })

function HoursList({ control, errors }) {
  return (
    <div>
      <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Opening hours</span>
      <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
        {DAYS.map((day, i) => (
          <Controller
            key={day}
            name={`hours.${i}`}
            control={control}
            render={({ field: { value, onChange } }) => {
              const error = errors.hours?.[i]?.to?.message
              return (
                <li className="flex flex-wrap items-center gap-2.5 text-[13.5px]">
                  <span className="w-[90px] font-medium">{day}</span>
                  <Switch size="sm" label={`Open on ${day}`} checked={value.open} onChange={(open) => onChange({ ...value, open })} />
                  {value.open ? (
                    <span className="flex items-center gap-1.5">
                      <Input type="time" aria-label={`${day} opens`} value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} className="min-h-9 w-[118px] px-2 py-1 text-[13px]" />
                      <span aria-hidden="true">–</span>
                      <Input type="time" aria-label={`${day} closes`} value={value.to} invalid={Boolean(error)} onChange={(e) => onChange({ ...value, to: e.target.value })} className="min-h-9 w-[118px] px-2 py-1 text-[13px]" />
                    </span>
                  ) : (
                    <span className="text-ink-4">Closed</span>
                  )}
                  {error && <span role="alert" className="basis-full pl-[100px] text-xs text-danger-ink">{error}</span>}
                </li>
              )
            }}
          />
        ))}
      </ul>
    </div>
  )
}

/** Settings → Branch: details, weekday hours and the branch pin (delivery-fee origin, pickup card, bean drop-off). */
export function BranchSettings({ branch, onSaved }) {
  const locations = useLocations()
  const reverse = useReverseGeocode()
  const barangayPoint = useBarangayPoint()
  const save = useSaveAdminSetting()
  const [pinError, setPinError] = useState(null)
  const [focus, setFocus] = useState({ municipality: branch.municipality, barangay: branch.barangay })
  const { register, control, handleSubmit, setValue, getValues, setError, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(branchFormSchema),
    defaultValues: toForm(branch),
  })
  const [municipality, location] = useWatch({ control, name: ['municipality', 'location'] })
  const town = locations.data?.find((t) => t.name === municipality)

  /** Picking from the dropdowns only moves the pin; a map click reverse-geocodes and fills the place (CLAUDE.md, Maps). */
  const movePin = (point, source) => {
    setPinError(null)
    if (source === 'select') return setValue('location', point, { shouldDirty: true })
    reverse.mutate(point, {
      onSuccess: (place) => {
        if (!place.insideDeliveryArea) return setPinError('Put the pin on the branch, inside Marinduque.')
        setValue('location', point, { shouldDirty: true, shouldValidate: true })
        setValue('municipality', place.municipality, { shouldDirty: true })
        setValue('barangay', place.barangay ?? '', { shouldDirty: true })
        setFocus({ municipality: place.municipality, barangay: place.barangay })
      },
      onError: (error) => setPinError(errorMessage(error)),
    })
  }
  const pickMunicipality = (name) => {
    if (name !== getValues('municipality')) setValue('barangay', '', { shouldDirty: true })
    setValue('municipality', name, { shouldDirty: true, shouldValidate: true })
    movePin(locations.data.find((t) => t.name === name).center, 'select')
    setFocus({ municipality: name, fit: true })
  }
  const pickBarangay = async (name) => {
    setValue('barangay', name, { shouldDirty: true, shouldValidate: true })
    const spot = await barangayPoint(getValues('municipality'), name).catch(() => null)
    if (getValues('barangay') !== name) return
    if (spot) movePin(spot, 'select')
    setFocus({ municipality: getValues('municipality'), barangay: name, fit: true })
  }

  const submit = handleSubmit((values) =>
    save.mutate(
      { section: 'branch', body: values },
      {
        onSuccess: (saved) => {
          reset(toForm(saved))
          onSaved()
        },
        onError: (error) => {
          if (error.response?.data?.errors?.location) setPinError(error.response.data.errors.location)
          if (!applyServerErrors(error, setError)) toast.error(errorMessage(error))
        },
      },
    ),
  )

  return (
    <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <SettingsCard title="Kaluppa branch" text="Used as the delivery-fee starting point, the pickup card at checkout and the bean drop-off instructions." className="flex-[1_1_420px]">
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField id="branch-name" label="Branch name" maxLength={80} error={errors.name?.message} {...register('name')} />
            <TextField id="branch-phone" label="Contact number" type="tel" maxLength={13} error={errors.phone?.message} {...register('phone')} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <SearchSelect label="Municipality" icon="pin" placeholder="Select municipality" searchPlaceholder="Search municipality" options={(locations.data ?? []).map((t) => t.name)} value={municipality || null} onChange={pickMunicipality} error={errors.municipality?.message} />
            <Controller
              name="barangay"
              control={control}
              render={({ field }) => (
                <SearchSelect label="Barangay" icon="home" placeholder={town ? 'Select barangay' : 'Pick a municipality first'} searchPlaceholder="Search barangay" options={town?.barangays ?? []} value={field.value || null} onChange={pickBarangay} disabled={!town} error={errors.barangay?.message} />
              )}
            />
          </div>
          <TextField id="branch-street" label="Street, building or landmark" maxLength={120} error={errors.street?.message} {...register('street')} />
          <HoursList control={control} errors={errors} />
        </SettingsCard>
        <SettingsCard title="Branch pin" text="Pick the barangay to zoom in, then click the exact spot." className="flex-[1_1_420px] gap-2.5 [&>p]:mt-0">
          <Suspense fallback={<div className="h-[460px] animate-pulse rounded-card bg-water" />}>
            <MapPicker
              value={location}
              onPick={movePin}
              focus={focus}
              error={pinError ?? errors.location?.message}
              busy={reverse.isPending}
              note={location ? `Pin at ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : null}
              pinLabel="Branch pin"
              ariaLabel="Branch location. Click to move the pin."
              searchable={false}
            />
          </Suspense>
        </SettingsCard>
      </div>
      {isDirty && <SaveBar formId={FORM_ID} pending={save.isPending} onDiscard={() => (reset(), setPinError(null))} />}
    </form>
  )
}
