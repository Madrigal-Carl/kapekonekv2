import { zodResolver } from '@hookform/resolvers/zod'
import { IconPlus, IconX } from '@/components/ui/icons'
import { useEffect, useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { VARIETIES } from '@/constants/charts'
import { BEAN_FORMS } from '@/constants/beans'
import { useBeanCap, useCreateBean, useUpdateBean } from '@/hooks/useBeans'
import { useFarmers } from '@/hooks/useFarmers'
import { useUploadImage } from '@/hooks/useUploads'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { formatKg, formatPesoShort } from '@/lib/format'
import { imageUrl } from '@/lib/image'
import { beanFormSchema } from '@/schemas/beans.schema'
import { NoteField } from '../records/TreeForm'

const MAX_PHOTOS = 5
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
const FARMER_LIMIT = 50 // shortcut: first 50 farmers of the association; add server search when one outgrows that
const toNumber = (v) => (v === '' || v == null ? undefined : Number(v))

const toForm = (listing) => ({
  farmerId: listing?.farmer.id ?? '',
  variety: listing?.variety ?? '',
  form: listing?.form ?? '',
  weightKg: listing?.weightKg ?? '',
  price: listing ? listing.pricePerKgCentavos / 100 : '',
  photos: listing?.photos ?? [],
  note: listing?.note ?? '',
})

/**
 * List beans for Kaluppa, or edit a pending listing (BeansFarmer.dc.html sell drawer). An unapproved farmer sees how much
 * of the 5 kg is left, and Send stays off above it; the server checks the cap again in a transaction.
 * @param {{ open: boolean, listing?: object | null, actsForFarmers: boolean, onClose: () => void }} props
 */
export function BeanForm({ open, listing = null, actsForFarmers, onClose }) {
  const formId = useId()
  const create = useCreateBean()
  const update = useUpdateBean()
  const [over, setOver] = useState(false)
  return (
    <Drawer
      open={open}
      width={640}
      eyebrow="Sell to Kaluppa"
      title={listing ? `Edit ${listing.listingNumber}` : 'List beans for Kaluppa'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="min-h-[42px] py-0 font-semibold">Cancel</Button>
          <Button type="submit" form={formId} disabled={over} pending={create.isPending || update.isPending} className="min-h-[42px] py-0">
            {listing ? 'Save changes' : 'Send to Kaluppa'}
          </Button>
        </>
      }
    >
      {open && (
        <BeanFields key={listing?.id ?? 'new'} formId={formId} listing={listing} actsForFarmers={actsForFarmers} create={create} update={update} onOver={setOver} onClose={onClose} />
      )}
    </Drawer>
  )
}

function BeanFields({ formId, listing, actsForFarmers, create, update, onOver, onClose }) {
  const needsFarmer = actsForFarmers && !listing
  const { register, control, handleSubmit, setError, formState: { errors } } = useForm({
    resolver: zodResolver(beanFormSchema({ needsFarmer })),
    defaultValues: toForm(listing),
  })
  const [farmerId, weight, price] = useWatch({ control, name: ['farmerId', 'weightKg', 'price'] })
  const farmers = useFarmers({ limit: FARMER_LIMIT }, { enabled: needsFarmer })
  const capFarmer = actsForFarmers ? (listing?.farmer.id ?? farmerId) : undefined
  const cap = useBeanCap(capFarmer, { enabled: !actsForFarmers || Boolean(capFarmer) })

  // Editing a pending listing that counts toward the cap gives its own kilograms back.
  const limited = cap.data && !cap.data.approved
  const left = limited ? cap.data.leftKg + (listing?.countsTowardCap ? listing.weightKg : 0) : Infinity
  const kgNow = Number(weight) || 0
  const over = limited && kgNow > left
  useEffect(() => onOver(over), [over, onOver])
  useEffect(() => () => onOver(false), [onOver])
  const who = actsForFarmers ? (farmers.data?.items.find((f) => f.id === capFarmer)?.firstName ?? listing?.farmer.name.split(' ')[0] ?? 'This farmer') : null
  const limitText = who ? `${who} can list up to ${formatKg(left)} more until approved.` : `You can list up to ${formatKg(left)} more until you’re approved.`
  const total = kgNow && Number(price) ? formatPesoShort(Math.round(kgNow * Number(price) * 100)) : '₱0'

  const save = handleSubmit(({ price: pricePerKgCentavos, ...values }) => {
    if (over) return
    const body = { ...values, pricePerKgCentavos, farmerId: needsFarmer ? values.farmerId : undefined }
    const options = {
      onSuccess: () => {
        toast.success(listing ? 'Listing updated.' : 'Listing sent. Kaluppa will review it soon.')
        onClose()
      },
      onError: (error) => {
        const mapped = applyServerErrors(error, (name, e) => setError(name === 'pricePerKgCentavos' ? 'price' : name, e))
        if (!mapped) toast.error(errorMessage(error))
      },
    }
    if (listing) update.mutate({ id: listing.id, ...body }, options)
    else create.mutate(body, options)
  })

  return (
    <form id={formId} noValidate onSubmit={save} className="contents">
      {needsFarmer && (
        <Controller
          name="farmerId"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Farmer"
              icon="home"
              placeholder="Select farmer"
              searchPlaceholder="Search farmer"
              options={(farmers.data?.items ?? [])
                .filter((f) => f.status === 'approved' || f.status === 'pending')
                .map((f) => ({ value: f.id, label: f.status === 'approved' ? f.name : `${f.name} · unapproved` }))}
              value={field.value || null}
              onChange={field.onChange}
              ref={field.ref}
              error={errors.farmerId?.message}
            />
          )}
        />
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <Controller
          name="variety"
          control={control}
          render={({ field }) => (
            <SearchSelect label="Variety" icon="tag" placeholder="Select variety" searchPlaceholder="Search variety" options={VARIETIES.map((v) => ({ value: v.key, label: v.label }))} value={field.value || null} onChange={field.onChange} ref={field.ref} error={errors.variety?.message} />
          )}
        />
        <Controller
          name="form"
          control={control}
          render={({ field }) => (
            <SearchSelect label="Form" icon="tag" placeholder="Select form" searchPlaceholder="Search form" options={BEAN_FORMS.map((f) => ({ value: f.key, label: f.label }))} value={field.value || null} onChange={field.onChange} ref={field.ref} error={errors.form?.message} />
          )}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id={`${formId}-kg`}
          label="Weight (kg)"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0.5"
          {...register('weightKg', { setValueAs: toNumber })}
          error={errors.weightKg?.message ?? (over ? `Over your limit. ${limitText}` : undefined)}
          hint={limited ? limitText : 'In steps of 0.5 kg.'}
        />
        <TextField
          id={`${formId}-price`}
          label="Your price per kg (₱)"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          {...register('price', { setValueAs: toNumber })}
          error={errors.price?.message}
          hint="You set the price. Kaluppa accepts or rejects it."
        />
      </div>
      <div className="flex items-center justify-between rounded-md bg-crema px-3.5 py-3 text-sm">
        <span>Total if approved</span>
        <strong className="text-lg">{total}</strong>
      </div>
      <Controller name="photos" control={control} render={({ field }) => <PhotoPicker photos={field.value} onChange={field.onChange} error={errors.photos?.message} />} />
      <NoteField id={`${formId}-note`} label="Note for Kaluppa" placeholder="e.g. Sun-dried 12 days, moisture around 12%" error={errors.note?.message} {...register('note')} />
    </form>
  )
}

/** Up to five photos in fixed square tiles, uploaded straight to Cloudinary (`bean_photo`). */
function PhotoPicker({ photos, onChange, error }) {
  const id = useId()
  const upload = useUploadImage('bean_photo')
  const [problem, setProblem] = useState(null)
  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    upload.mutate({ file }, { onSuccess: (ref) => onChange([...photos, ref]), onError: (e) => setProblem(e.message || 'Upload failed. Try again.') })
  }
  const message = problem ?? error
  return (
    <div>
      <span id={`${id}-l`} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">
        Photos <span className="normal-case tracking-normal text-ink-4">(up to 5, images up to 5 MB each)</span>
      </span>
      <ul aria-labelledby={`${id}-l`} className="m-0 mt-2 grid list-none grid-cols-5 gap-2 p-0">
        {photos.map((p, i) => (
          <li key={p.publicId} className="relative aspect-square overflow-hidden rounded-md bg-photo">
            <img src={imageUrl(p.url, 120)} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <button
              type="button"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => onChange(photos.filter((x) => x.publicId !== p.publicId))}
              className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-espresso/70 text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              <IconX aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li className="aspect-square">
            <label className="grid size-full cursor-pointer place-items-center rounded-md border-[1.5px] border-dashed border-sand-strong bg-white text-roast hover:bg-cream focus-within:outline-2 focus-within:outline-roast">
              <span className="sr-only">Add photo</span>
              {upload.isPending ? <span className="text-[11px] font-semibold">{upload.progress}%</span> : <IconPlus aria-hidden="true" className="size-5" strokeWidth={2} />}
              <input type="file" accept={IMAGE_TYPES} aria-describedby={`${id}-e`} disabled={upload.isPending} onChange={pick} className="sr-only" />
            </label>
          </li>
        )}
      </ul>
      <span id={`${id}-e`} role={message ? 'alert' : undefined} className="mt-1.5 block text-xs text-danger-ink">{message}</span>
    </div>
  )
}
