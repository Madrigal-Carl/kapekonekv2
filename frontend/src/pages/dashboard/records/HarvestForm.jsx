import { zodResolver } from '@hookform/resolvers/zod'
import { History } from '@/components/dashboard/History'
import { useEffect, useId, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { TextField } from '@/components/dashboard/RecordParts'
import { ConfirmChangesModal } from '@/components/ui/ConfirmChangesModal'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { VARIETIES } from '@/constants/charts'
import { useDirtyDiff, useSaveConfirm } from '@/hooks/useDirtyDiff'
import { useCreateHarvest, useRecordFarms, useUpdateHarvest } from '@/hooks/useRecords'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { todayKey } from '@/schemas/rules'
import { harvestFormSchema } from '@/schemas/records.schema'
import { FormFooter } from '../farmers/FarmerForm'
import { FarmPicker, NoteField } from './TreeForm'

const FIELDS = ['farmId', 'variety', 'yieldKg', 'harvestedAt', 'note']
const label = (key) => VARIETIES.find((v) => v.key === key)?.label ?? key
const andList = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`)

const toForm = (harvest) => ({
  farmId: harvest?.farm.id ?? '',
  variety: harvest?.variety ?? '',
  yieldKg: harvest?.yieldKg ?? '',
  harvestedAt: harvest?.harvestedAt ?? todayKey(),
  note: harvest?.note ?? '',
})

/**
 * Record or edit a harvest (Harvests.dc.html, HarvestForm board). The variety list is the picked farm's varieties.
 * @param {{ open: boolean, harvest?: object|null, actsForFarmers: boolean, onClose: () => void }} props
 */
export function HarvestForm({ open, harvest = null, actsForFarmers, onClose }) {
  const formId = useId()
  const farms = useRecordFarms(open)
  const create = useCreateHarvest()
  const update = useUpdateHarvest()
  const [unchanged, setUnchanged] = useState(Boolean(harvest))
  return (
    <Drawer
      open={open}
      eyebrow="Harvest"
      title={harvest ? 'Edit harvest' : 'Record a harvest'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={harvest ? 'Save changes' : 'Save harvest'} unchanged={unchanged} />}
    >
      {open && farms.data && (
        <HarvestFields key={harvest?.id ?? 'new'} formId={formId} harvest={harvest} farms={farms.data} actsForFarmers={actsForFarmers} create={create} update={update} onClose={onClose} onUnchanged={setUnchanged} />
      )}
      {open && harvest && <History entityType="harvest" entityId={harvest.id} />}
    </Drawer>
  )
}

function HarvestFields({ formId, harvest, farms, actsForFarmers, create, update, onClose, onUnchanged }) {
  const initial = useMemo(() => toForm(harvest), [harvest])
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm({
    resolver: zodResolver(harvestFormSchema),
    defaultValues: initial,
  })
  const farmName = (fid) => (fid === harvest?.farm.id ? harvest.farm.propertyNumber : farms.find((f) => f.id === fid)?.propertyNumber ?? '—')
  const changes = useDirtyDiff(initial, useWatch({ control }), {
    farmId: { label: 'Farm', format: farmName },
    variety: { label: 'Variety', format: label },
    yieldKg: { label: 'Yield', format: (v) => `${Number(v).toLocaleString('en-PH')} kg` },
    harvestedAt: 'Harvested on',
    note: 'Notes',
  })
  useEffect(() => onUnchanged(Boolean(harvest) && changes.length === 0), [harvest, changes.length, onUnchanged])
  const farmId = useWatch({ control, name: 'farmId' })
  const farm = farms.find((f) => f.id === farmId)
  // An edited harvest's farm may be off the first page of options; its own variety stays pickable.
  const varieties = farm?.varieties ?? (harvest && farmId === harvest.farm.id ? [harvest.variety] : [])

  const options = {
    onSuccess: () => {
      toast.success(harvest ? 'Harvest updated.' : 'Harvest saved.')
      onClose()
    },
    onError: (error) => {
      if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
    },
  }
  const confirm = useSaveConfirm(Boolean(harvest), (body) => update.mutate(body, options))
  const save = handleSubmit((values) => {
    if (harvest) confirm.submit({ id: harvest.id, ...values })
    else create.mutate(values, options)
  })

  return (
    <form id={formId} noValidate onSubmit={save} className="contents">
      <ConfirmChangesModal {...confirm.modal} changes={changes} pending={update.isPending} />
      <Controller
        name="farmId"
        control={control}
        render={({ field }) => (
          <FarmPicker
            farms={farms}
            current={harvest && { ...harvest.farm, owner: harvest.owner }}
            actsForFarmers={actsForFarmers}
            value={field.value}
            onChange={(next) => {
              field.onChange(next)
              setValue('variety', '')
            }}
            fieldRef={field.ref}
            error={errors.farmId?.message}
          />
        )}
      />
      <div>
        <Controller
          name="variety"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Variety"
              icon="tag"
              placeholder={farmId ? 'Select variety' : 'Pick a farm first'}
              searchPlaceholder="Search variety"
              options={varieties.map((v) => ({ value: v, label: label(v) }))}
              value={field.value || null}
              onChange={field.onChange}
              disabled={!farmId}
              ref={field.ref}
              error={errors.variety?.message}
            />
          )}
        />
        {farm && (
          <p className="mt-2 text-xs text-ink-3">
            {farm.varieties.length
              ? `This farm has ${andList(farm.varieties.map(label))} trees, so only those varieties are listed.`
              : 'This farm has no trees yet. Add a tree group to it first.'}
          </p>
        )}
      </div>
      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <TextField
          id={`${formId}-kg`}
          label="Yield (kg)"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder="e.g. 120"
          error={errors.yieldKg?.message}
          {...register('yieldKg', { setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)) })}
        />
        <TextField id={`${formId}-date`} label="Harvested on" type="date" max={todayKey()} error={errors.harvestedAt?.message} {...register('harvestedAt')} />
      </div>
      <NoteField id={`${formId}-note`} label="Notes" placeholder="e.g. Red cherries only, dried on raised beds" error={errors.note?.message} {...register('note')} />
    </form>
  )
}
