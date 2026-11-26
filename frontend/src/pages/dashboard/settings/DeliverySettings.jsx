import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { TextField } from '@/components/dashboard/RecordParts'
import { FieldHint, Input, Label } from '@/components/ui/Input'
import { useSaveAdminSetting } from '@/hooks/useAdminSettings'
import { errorMessage } from '@/lib/applyServerErrors'
import { feeForDistance, formatPesoShort } from '@/lib/format'
import { deliveryFormSchema } from '@/schemas/setting.schema'
import { SaveBar, SettingsCard } from './SettingsParts'

const FORM_ID = 'settings-delivery'
const toForm = (d) => ({
  baseFee: d.baseFeeCentavos / 100,
  baseKm: d.baseKm,
  perKm: d.perKmCentavos / 100,
  roundUpTo: d.roundUpToCentavos / 100,
  maxKm: d.maxKm,
  minBusinessDays: d.minBusinessDays,
  maxBusinessDays: d.maxBusinessDays,
})
const SERVER_FIELDS = { baseFeeCentavos: 'baseFee', perKmCentavos: 'perKm', roundUpToCentavos: 'roundUpTo' }
const num = { valueAsNumber: true }

/** "Try it": the fee for a road distance under the rules as typed (not yet saved). */
function TryIt({ control }) {
  const [km, setKm] = useState(5)
  const [baseFee, baseKm, perKm, roundUpTo, maxKm] = useWatch({ control, name: ['baseFee', 'baseKm', 'perKm', 'roundUpTo', 'maxKm'] })
  const rules = { baseFeeCentavos: Math.round(baseFee * 100), baseKm, perKmCentavos: Math.round(perKm * 100), roundUpToCentavos: Math.round(roundUpTo * 100) }
  const ready = [km, ...Object.values(rules), maxKm].every(Number.isFinite) && rules.roundUpToCentavos > 0
  const outside = ready && km > maxKm
  const extraKm = Math.round(Math.max(0, km - baseKm) * 10) / 10
  return (
    <SettingsCard title="Try it" className="flex-[1_1_320px] gap-0">
      <Label htmlFor="try-km" className="mt-3">Road distance (km)</Label>
      <Input id="try-km" type="number" min="0" step="0.1" value={Number.isFinite(km) ? km : ''} onChange={(e) => setKm(e.target.valueAsNumber)} className="mt-1.5 min-h-[42px] px-3 py-[9px]" />
      <div className="mt-3.5 rounded-card bg-crema p-3.5" aria-live="polite">
        <span className="block text-[12.5px] text-ink-2">Delivery fee</span>
        <span className="block text-[26px] font-semibold">{!ready ? '—' : outside ? 'Outside the area' : formatPesoShort(feeForDistance(km, rules))}</span>
        {ready && (
          <span className="block text-xs text-ink-3">
            {outside
              ? `More than ${maxKm} km by road.`
              : `${formatPesoShort(rules.baseFeeCentavos)} for the first ${baseKm} km + ${formatPesoShort(rules.perKmCentavos)} × ${extraKm} km, rounded up to ${formatPesoShort(rules.roundUpToCentavos)}`}
          </span>
        )}
      </div>
    </SettingsCard>
  )
}

/** Settings → Delivery fee: base fee, per-km rate, rounding, maximum distance, delivery estimate; plus the calculator. */
export function DeliverySettings({ delivery, onSaved }) {
  const save = useSaveAdminSetting()
  const { register, control, handleSubmit, setError, reset, formState: { errors, isDirty } } = useForm({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: toForm(delivery),
  })
  const submit = handleSubmit(({ baseFee, perKm, roundUpTo, ...rest }) =>
    save.mutate(
      { section: 'delivery', body: { baseFeeCentavos: baseFee, perKmCentavos: perKm, roundUpToCentavos: roundUpTo, ...rest } },
      {
        onSuccess: (saved) => {
          reset(toForm(saved))
          onSaved()
        },
        onError: (error) => {
          const fields = error.response?.data?.errors
          if (fields) for (const [field, message] of Object.entries(fields)) setError(SERVER_FIELDS[field] ?? field, { message })
          else toast.error(errorMessage(error))
        },
      },
    ),
  )
  const etaError = errors.minBusinessDays?.message ?? errors.maxBusinessDays?.message

  return (
    <form id={FORM_ID} noValidate onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <SettingsCard title="Delivery fee" text={`Distance is the road distance from the branch pin (Mapbox). If that fails, straight-line distance × ${delivery.roadFactorFallback}.`} className="flex-[1_1_420px]">
          <div className="grid gap-5 min-[720px]:grid-cols-2">
            <TextField id="fee-base" label="Base fee (₱)" type="number" min="0" step="0.01" error={errors.baseFee?.message} {...register('baseFee', num)} />
            <TextField id="fee-base-km" label="Covers the first (km)" type="number" min="0" step="0.1" error={errors.baseKm?.message} {...register('baseKm', num)} />
          </div>
          <div className="grid gap-5 min-[720px]:grid-cols-2">
            <TextField id="fee-per-km" label="Per km after that (₱)" type="number" min="0" step="0.01" error={errors.perKm?.message} {...register('perKm', num)} />
            <TextField id="fee-round" label="Round up to the nearest (₱)" type="number" min="1" step="1" error={errors.roundUpTo?.message} {...register('roundUpTo', num)} />
          </div>
          <div className="grid gap-5 min-[720px]:grid-cols-2">
            <TextField id="fee-max" label="Maximum distance (km)" type="number" min="1" step="1" hint="Farther pins are outside the delivery area." error={errors.maxKm?.message} {...register('maxKm', num)} />
            <div role="group" aria-labelledby="eta-label">
              <span id="eta-label" className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">Delivery estimate (business days)</span>
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" min="1" step="1" aria-label="Earliest business day" invalid={Boolean(errors.minBusinessDays)} className="min-h-11 px-[13px]" {...register('minBusinessDays', num)} />
                <span aria-hidden="true">–</span>
                <Input type="number" min="1" step="1" aria-label="Latest business day" invalid={Boolean(errors.maxBusinessDays)} className="min-h-11 px-[13px]" {...register('maxBusinessDays', num)} />
              </div>
              <FieldHint error={etaError} className="mt-1.5 text-xs leading-normal">Counted from confirmation.</FieldHint>
            </div>
          </div>
        </SettingsCard>
        <TryIt control={control} />
      </div>
      {isDirty && <SaveBar formId={FORM_ID} pending={save.isPending} onDiscard={() => reset()} />}
    </form>
  )
}
