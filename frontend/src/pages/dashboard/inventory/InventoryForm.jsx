import { zodResolver } from '@hookform/resolvers/zod'
import { useId, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Drawer } from '@/components/dashboard/Drawer'
import { TextField } from '@/components/dashboard/RecordParts'
import { Button } from '@/components/ui/Button'
import { IconPlus, IconStar, IconX } from '@/components/ui/icons'
import { FieldHint, inputClasses, Label } from '@/components/ui/Input'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { Switch } from '@/components/ui/Switch'
import { COFFEE_TYPES, VARIETIES } from '@/constants/catalog'
import { useCreateProduct, useUpdateProduct } from '@/hooks/useInventory'
import { useUploadImage } from '@/hooks/useUploads'
import { applyServerErrors, errorMessage } from '@/lib/applyServerErrors'
import { cn } from '@/lib/cn'
import { imageUrl } from '@/lib/image'
import { productFormSchema } from '@/schemas/product.schema'
import { PRODUCT_CATEGORIES } from '@/schemas/rules'
import { CATEGORY_OPTIONS, unitText } from './inventoryText'

const MAX_PHOTOS = 5
const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif'
const toNumber = (v) => (v === '' || v == null ? undefined : Number(v))
const options = (map, label = (v) => v) => Object.entries(map).map(([value, v]) => ({ value, label: label(v) }))

const toForm = (p) => ({
  name: p?.name ?? '',
  category: p?.category?.slug ?? '',
  variety: p?.variety ?? null,
  coffeeType: p?.coffeeType ?? null,
  unit: p?.unit ?? '',
  price: p ? p.priceCentavos / 100 : '',
  stock: p?.stock ?? '',
  description: p?.description ?? '',
  photos: p?.photos ?? [],
  isFeatured: p?.isFeatured ?? false,
  isActive: p?.isActive ?? true,
})

/** The thumbnail is the marked photo, or the first one. */
const thumbIndex = (photos) => Math.max(0, photos.findIndex((p) => p.isThumbnail))
const markThumb = (photos, index) => photos.map((p, i) => ({ ...p, isThumbnail: i === index }))

/**
 * Add or edit a product (InventoryForm.dc.html): category-dependent fields, photos with a picked thumbnail, Featured
 * (coffee only) and Active switches.
 * @param {{ open: boolean, product?: object | null, onClose: () => void }} props
 */
export function InventoryForm({ open, product = null, onClose }) {
  const formId = useId()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  return (
    <Drawer
      open={open}
      width={660}
      eyebrow="Inventory"
      title={product ? `Edit ${product.name}` : 'Add a product'}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={formId} loading={create.isPending || update.isPending}>
            {product ? 'Save changes' : 'Add product'}
          </Button>
        </>
      }
    >
      {open && <ProductFields key={product?._id ?? 'new'} formId={formId} product={product} create={create} update={update} onClose={onClose} />}
    </Drawer>
  )
}

function ProductFields({ formId, product, create, update, onClose }) {
  const { register, control, handleSubmit, setError, setValue, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(productFormSchema),
    defaultValues: toForm(product),
  })
  const category = useWatch({ control, name: 'category' })
  const rules = PRODUCT_CATEGORIES[category]

  const pickCategory = (next) => {
    const nextRules = PRODUCT_CATEGORIES[next]
    setValue('category', next, { shouldValidate: true })
    if (!nextRules.units.includes(getValues('unit'))) setValue('unit', nextRules.units.length === 1 ? nextRules.units[0] : '')
    if (!nextRules.variety) setValue('variety', null)
    if (!nextRules.coffeeType) setValue('coffeeType', null)
    if (!nextRules.featured) setValue('isFeatured', false)
  }

  const save = handleSubmit(({ price: priceCentavos, ...values }) => {
    const body = { ...values, priceCentavos }
    const done = {
      onSuccess: (saved) => {
        toast.success(product ? `${saved.name ?? values.name} saved.` : `${values.name} added to the store.`)
        onClose()
      },
      onError: (error) => {
        const mapped = applyServerErrors(error, (name, e) => setError(name === 'priceCentavos' ? 'price' : name, e))
        if (!mapped) toast.error(errorMessage(error))
      },
    }
    if (product) update.mutate({ id: product._id, ...body }, done)
    else create.mutate(body, done)
  })

  return (
    <form id={formId} noValidate onSubmit={save} className="contents">
      <TextField id={`${formId}-name`} label="Product name" placeholder="e.g. Barako Medium Roast" maxLength={80} error={errors.name?.message} {...register('name')} />
      <Controller
        name="category"
        control={control}
        render={({ field }) => (
          <SearchSelect label="Category" icon="tag" placeholder="Select category" searchPlaceholder="Search category" options={CATEGORY_OPTIONS} value={field.value || null} onChange={pickCategory} ref={field.ref} error={errors.category?.message} />
        )}
      />
      {(rules?.variety || rules?.coffeeType) && (
        <div className="grid gap-5 min-[720px]:grid-cols-2">
          {rules.variety && (
            <Controller
              name="variety"
              control={control}
              render={({ field }) => (
                <SearchSelect label="Variety" icon="tag" placeholder="Select variety" searchPlaceholder="Search variety" options={options(VARIETIES)} value={field.value} onChange={field.onChange} ref={field.ref} error={errors.variety?.message} />
              )}
            />
          )}
          {rules.coffeeType && (
            <Controller
              name="coffeeType"
              control={control}
              render={({ field }) => (
                <SearchSelect label="Coffee type" icon="tag" placeholder="Select type" searchPlaceholder="Search coffee type" options={options(COFFEE_TYPES, (t) => t.long)} value={field.value} onChange={field.onChange} ref={field.ref} error={errors.coffeeType?.message} />
              )}
            />
          )}
        </div>
      )}
      <div className="grid gap-5 min-[720px]:grid-cols-3">
        <Controller
          name="unit"
          control={control}
          render={({ field }) => (
            <SearchSelect
              label="Unit"
              icon="tag"
              placeholder="Unit"
              searchable={false}
              options={(rules?.units ?? []).map((u) => ({ value: u, label: unitText(u) }))}
              value={field.value || null}
              onChange={field.onChange}
              ref={field.ref}
              disabled={!rules}
              error={errors.unit?.message}
            />
          )}
        />
        <TextField id={`${formId}-price`} label="Price (₱)" type="number" inputMode="decimal" min="1" step="0.01" placeholder="0.00" error={errors.price?.message} {...register('price', { setValueAs: toNumber })} />
        <TextField
          id={`${formId}-stock`}
          label="Stock"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="0"
          hint="Low-stock alert below 10 (50 for seedlings)."
          error={errors.stock?.message}
          {...register('stock', { setValueAs: toNumber })}
        />
      </div>
      <Controller name="photos" control={control} render={({ field }) => <PhotoPicker photos={field.value} onChange={field.onChange} error={errors.photos?.message ?? errors.photos?.root?.message} />} />
      <div>
        <Label htmlFor={`${formId}-desc`}>Description</Label>
        <textarea
          id={`${formId}-desc`}
          rows={4}
          maxLength={2000}
          placeholder="Taste, size, how to use"
          aria-invalid={Boolean(errors.description)}
          aria-describedby={`${formId}-desc-hint`}
          className={cn(inputClasses, 'mt-2 resize-y px-[13px] py-2.5 leading-[1.55]')}
          {...register('description')}
        />
        <FieldHint id={`${formId}-desc-hint`} error={errors.description?.message} className="mt-1.5 text-xs leading-normal" />
      </div>
      <Controller
        name="isFeatured"
        control={control}
        render={({ field }) => (
          <SwitchRow title="Featured on the landing page" text="Coffee only. Shown in the hero carousel and featured row." checked={field.value} onChange={field.onChange} disabled={!rules?.featured} error={errors.isFeatured?.message} />
        )}
      />
      <Controller
        name="isActive"
        control={control}
        render={({ field }) => <SwitchRow title="Active" text="Inactive products are hidden from the store but kept here." checked={field.value} onChange={field.onChange} />}
      />
    </form>
  )
}

function SwitchRow({ title, text, checked, onChange, disabled, error }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3.5 rounded-lg border border-sand px-3.5 py-3">
        <span>
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-ink-3">{text}</span>
        </span>
        <Switch label={title} checked={checked} onChange={onChange} disabled={disabled} />
      </div>
      {error && <span role="alert" className="mt-1.5 block text-xs text-danger-ink">{error}</span>}
    </div>
  )
}

/** Up to five photos (`product_photo`); clicking one makes it the thumbnail; removing the thumbnail promotes the first left. */
function PhotoPicker({ photos, onChange, error }) {
  const id = useId()
  const upload = useUploadImage('product_photo')
  const [problem, setProblem] = useState(null)
  const thumb = thumbIndex(photos)
  const pick = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setProblem(null)
    upload.mutate({ file }, { onSuccess: (ref) => onChange(markThumb([...photos, ref], thumb)), onError: (e) => setProblem(e.message || 'Upload failed. Try again.') })
  }
  const remove = (index) => {
    const left = photos.filter((_, i) => i !== index)
    onChange(markThumb(left, index === thumb ? 0 : thumb > index ? thumb - 1 : thumb))
  }
  const message = problem ?? error
  return (
    <div>
      <span id={`${id}-l`} className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-2">
        Photos <span className="normal-case tracking-normal text-ink-4">(up to 5, images up to 5 MB each)</span>
      </span>
      <span className="mt-1 block text-xs text-ink-3">Click a photo to make it the thumbnail. It shows on product cards, in the cart and on orders.</span>
      <ul aria-labelledby={`${id}-l`} className="m-0 mt-2.5 grid list-none grid-cols-5 gap-2.5 p-0">
        {photos.map((p, i) => (
          <li key={p.publicId} className="relative">
            <Button
              variant="bare"
              aria-pressed={i === thumb}
              aria-label={`Photo ${i + 1}${i === thumb ? ', thumbnail' : ', make thumbnail'}`}
              onClick={() => onChange(markThumb(photos, i))}
              className={cn('block aspect-square w-full overflow-hidden rounded-lg bg-photo p-0', i === thumb ? 'border-2 border-roast ring-2 ring-roast/25' : 'border border-sand')}
            >
              <img src={imageUrl(p.url, 120)} alt="" className="size-full object-cover" />
            </Button>
            {i === thumb && (
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-roast px-[7px] py-0.5 text-[10.5px] font-semibold text-white">
                <IconStar aria-hidden="true" className="size-2.5 fill-current" />
                Thumbnail
              </span>
            )}
            <Button
              variant="bare"
              aria-label={`Remove photo ${i + 1}`}
              onClick={() => remove(i)}
              className="absolute right-1.5 top-1.5 grid size-[26px] place-items-center rounded-full bg-espresso/70 text-white focus-visible:outline-2 focus-visible:outline-white"
            >
              <IconX aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
            </Button>
          </li>
        ))}
        {photos.length < MAX_PHOTOS && (
          <li className="aspect-square">
            <label className="grid size-full cursor-pointer place-items-center rounded-lg border-[1.5px] border-dashed border-sand-strong bg-white text-roast hover:bg-cream focus-within:outline-2 focus-within:outline-roast">
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
