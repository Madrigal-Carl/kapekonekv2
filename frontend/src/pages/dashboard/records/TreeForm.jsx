import { zodResolver } from '@hookform/resolvers/zod'
import { History } from '@/components/dashboard/History'
import { useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { TREE_STAGES, VARIETIES } from '@/constants/charts'
import { useCreateTreeGroup, useRecordFarms, useUpdateTreeGroup } from '@/hooks/useRecords'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { todayKey } from '@/schemas/rules'
import { cn } from '@/lib/cn'
import { treeGroupFormSchema } from '@/schemas/records.schema'
import { FormFooter } from '../farmers/FarmerForm'

const FIELDS = ['farmId', 'variety', 'stage', 'count', 'plantedAt', 'note']
const toNumber = (v) => (v === '' || v == null ? undefined : Number(v))
const KALUPPA = 'kaluppa'
const ownerOf = (farm) => (farm ? (farm.ownerType === 'kaluppa' ? KALUPPA : farm.owner.id) : '')

/**
 * Farmer (Group Managers only, to narrow the list) then Farm (Trees.dc.html, Harvests.dc.html).
 * `current` keeps an edited record's farm listed even when it's past the first page (with the record's owner: `recordFarm` has none).
 */
export function FarmPicker({ farms = [], current, actsForFarmers, value, onChange, error, fieldRef }) {
  const all = current && !farms.some((f) => f.id === current.id) ? [current, ...farms] : farms
  const [owner, setOwner] = useState(() => ownerOf(all.find((f) => f.id === value)))
  const owners = [...new Map(all.filter((f) => f.ownerType === 'farmer').map((f) => [f.owner.id, f.owner.name])).entries()].map(([id, name]) => ({ value: id, label: name }))
  if (all.some((f) => f.ownerType === 'kaluppa')) owners.push({ value: KALUPPA, label: 'Kaluppa farm (you manage)' })
  const shown = actsForFarmers && owner ? all.filter((f) => ownerOf(f) === owner) : all
  return (
    <>
      {actsForFarmers && (
        <SearchSelect
          label="Farmer"
          icon="home"
          placeholder="Select farmer"
          searchPlaceholder="Search farmer"
          options={owners}
          value={owner || null}
          onChange={(next) => {
            setOwner(next)
            if (value && ownerOf(all.find((f) => f.id === value)) !== next) onChange('')
          }}
        />
      )}
      <SearchSelect
        label="Farm"
        icon="pin"
        placeholder="Select farm"
        searchPlaceholder="Search farm"
        options={shown.map((f) => ({ value: f.id, label: `${f.propertyNumber} · ${f.lotNumber}` }))}
        value={value || null}
        onChange={onChange}
        ref={fieldRef}
        error={error}
      />
    </>
  )
}

/** Note box: a textarea in the drawers, matching TextField's label and hint. */
export function NoteField({ id, label = 'Note', placeholder, error, ...textarea }) {
  return (
    <div>
      <Label htmlFor={id}>
        {label}
        <span className="normal-case tracking-normal text-ink-4"> (optional)</span>
      </Label>
      <textarea
        id={id}
        rows={3}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint`}
        className={cn(inputClasses, 'mt-2 resize-y px-[13px] py-2.5')}
        {...textarea}
      />
      <FieldHint id={`${id}-hint`} error={error} className="mt-1.5 text-xs leading-normal" />
    </div>
  )
}

const toForm = (group, farmId) => ({
  farmId: group?.farm.id ?? farmId ?? '',
  variety: group?.variety ?? '',
  stage: group?.stage ?? '',
  count: group?.count ?? '',
  plantedAt: group?.plantedAt ?? '',
  note: group?.note ?? '',
})

/**
 * The tree group fields, in the Trees drawer or inline on a farm's Trees tab (`farm` fixes the farm and hides the picker).
 * Pass `create`/`update` when a drawer footer shows their pending state.
 * @param {{ formId: string, group?: object|null, farm?: object, farms?: object[], actsForFarmers?: boolean, onSaved: () => void, inline?: boolean, create?: object, update?: object }} props
 */
export function TreeGroupFields({ formId, group = null, farm, farms, actsForFarmers = false, onSaved, inline = false, ...mutations }) {
  const ownCreate = useCreateTreeGroup()
  const ownUpdate = useUpdateTreeGroup()
  const create = mutations.create ?? ownCreate
  const update = mutations.update ?? ownUpdate
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(treeGroupFormSchema),
    defaultValues: toForm(group, farm?.id),
  })
  const save = handleSubmit((values) => {
    const options = {
      onSuccess: () => {
        toast.success(group ? 'Tree group updated.' : `Tree group added${farm ? ` to ${farm.propertyNumber}` : ''}.`)
        onSaved()
      },
      onError: (error) => {
        if (!applyServerErrors(error, setError, FIELDS)) toast.error(errorMessage(error))
      },
    }
    if (group) update.mutate({ id: group.id, ...values }, options)
    else create.mutate(values, options)
  })
  const pending = create.isPending || update.isPending
  const id = (name) => `${formId}-${name}`

  return (
    <form id={formId} noValidate onSubmit={save} className={inline ? 'flex flex-col gap-3 rounded-lg border border-sand-soft bg-cream p-4' : 'contents'}>
      {!farm && (
        <Controller
          name="farmId"
          control={control}
          render={({ field }) => (
            <FarmPicker farms={farms} current={group && { ...group.farm, owner: group.owner }} actsForFarmers={actsForFarmers} value={field.value} onChange={field.onChange} fieldRef={field.ref} error={errors.farmId?.message} />
          )}
        />
      )}
      <div className={cn('grid gap-3 min-[720px]:grid-cols-2', !inline && 'gap-5')}>
        <Controller
          name="variety"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Variety"
              icon="tag"
              placeholder="Select variety"
              searchPlaceholder="Search variety"
              options={VARIETIES.map((v) => ({ value: v.key, label: v.label }))}
              value={field.value || null}
              onChange={field.onChange}
              ref={field.ref}
              error={errors.variety?.message}
            />
          )}
        />
        <Controller
          name="stage"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Stage"
              icon="tag"
              placeholder="Select stage"
              searchPlaceholder="Search stage"
              options={TREE_STAGES.map((s) => ({ value: s.key, label: s.label }))}
              value={field.value || null}
              onChange={field.onChange}
              ref={field.ref}
              error={errors.stage?.message}
            />
          )}
        />
      </div>
      <div className="grid gap-5 min-[720px]:grid-cols-2">
        <TextField id={id('count')} label="Number of trees" type="number" inputMode="numeric" min="1" step="1" placeholder="e.g. 40" error={errors.count?.message} {...register('count', { setValueAs: toNumber })} />
        <TextField id={id('planted')} label="Date planted" type="date" max={todayKey()} error={errors.plantedAt?.message} {...register('plantedAt')} />
      </div>
      {inline ? (
        <TextField id={id('note')} label="Note" optional placeholder="e.g. Replanted after typhoon" error={errors.note?.message} {...register('note')} />
      ) : (
        <NoteField id={id('note')} placeholder="e.g. Leaf rust on the lower rows" error={errors.note?.message} {...register('note')} />
      )}
      {inline && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onSaved}>Cancel</Button>
          <Button size="sm" type="submit" loading={pending}>{group ? 'Save changes' : 'Add trees'}</Button>
        </div>
      )}
    </form>
  )
}

/**
 * Add or edit a tree group (Trees.dc.html, TreeForm board).
 * @param {{ open: boolean, group?: object|null, actsForFarmers: boolean, onClose: () => void }} props
 */
export function TreeForm({ open, group = null, actsForFarmers, onClose }) {
  const formId = useId()
  const farms = useRecordFarms(open)
  const create = useCreateTreeGroup()
  const update = useUpdateTreeGroup()
  return (
    <Drawer
      open={open}
      eyebrow="Tree group"
      title={group ? 'Edit tree group' : 'Add a tree group'}
      onClose={onClose}
      footer={<FormFooter formId={formId} onClose={onClose} pending={create.isPending || update.isPending} label={group ? 'Save changes' : 'Add trees'} />}
    >
      {open && farms.data && <TreeGroupFields key={group?.id ?? 'new'} formId={formId} group={group} farms={farms.data} actsForFarmers={actsForFarmers} onSaved={onClose} create={create} update={update} />}
      {open && group && <History entityType="tree_group" entityId={group.id} />}
    </Drawer>
  )
}
