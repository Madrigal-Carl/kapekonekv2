import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/dashboard/ConfirmModal'
import { DataTable } from '@/components/dashboard/DataTable'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ProductImage } from '@/components/product/ProductImage'
import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/ui/icons'
import { useArchiveProduct, useInventory, useInventoryProduct, useRestoreProduct } from '@/hooks/useInventory'
import { useTableParams } from '@/hooks/useTableParams'
import { errorMessage } from '@/lib/applyServerErrors'
import { formatPeso } from '@/lib/format'
import { squareUrl } from '@/lib/image'
import { NotFound } from '@/pages/errors/NotFound'
import { DashPage } from '../overview/Overview'
import { InventoryForm } from './InventoryForm'
import { CATEGORY_OPTIONS, CATEGORY_TONES, productSub, STOCK_STATES, stockText, unitText } from './inventoryText'

const PAGE_SIZE = 10
const STATUS = { label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'archived', label: 'Archived' }] }
const FILTERS = [
  { key: 'category', label: 'Category', options: [{ value: '', label: 'All categories' }, ...CATEGORY_OPTIONS] },
  { key: 'stock', label: 'Stock', options: [{ value: '', label: 'Any stock' }, { value: 'low', label: 'Low stock' }, { value: 'out', label: 'Out of stock' }, { value: 'in', label: 'In stock' }] },
]

const toRow = (p) => ({
  id: p._id,
  label: p.name,
  product: { main: p.name, sub: productSub(p), image: p.photos[0]?.url },
  category: { label: p.category?.name ?? '—', tone: CATEGORY_TONES[p.category?.slug] ?? 'gray' },
  unit: unitText(p.unit),
  price: formatPeso(p.priceCentavos),
  stock: { main: stockText(p.stock, p.unit), sub: STOCK_STATES[p.stockState] },
  status: p.archivedAt ? { label: 'Archived', tone: 'gray' } : p.isActive ? { label: 'Active', tone: 'green' } : { label: 'Inactive', tone: 'gray' },
  actions: p.archivedAt ? ['restore'] : ['edit', 'archive'],
  record: p,
})

/** Photo (or the default image), name and the variety / size line (Inventory.dc.html "product" cells). */
const productCell = ({ main, sub, image }) => (
  <span className="flex items-center gap-2.5">
    <ProductImage src={image && squareUrl(image, 40)} className="size-10 shrink-0 overflow-hidden rounded-md" />
    <span className="flex min-w-0 flex-col">
      <span className="font-semibold">{main}</span>
      {sub && <span className="text-xs text-ink-3">{sub}</span>}
    </span>
  </span>
)

/** What Kaluppa sells (Inventory.dc.html): table, add/edit drawer, archive/restore modals. */
export function Inventory() {
  const query = useTableParams({ status: 'active' })
  const { params, set } = query
  const list = useInventory({ status: params.status, category: params.category, stock: params.stock, q: params.q, page: params.page, limit: PAGE_SIZE })
  const editingId = params.mode === 'edit' ? params.open : null
  const editing = useInventoryProduct(editingId)
  const archive = useArchiveProduct()
  const restore = useRestoreProduct()
  const [modal, setModal] = useState(null) // { kind: 'archive'|'restore', product }
  const close = () => set({ open: null, mode: null })

  const onAction = (action, row) => {
    if (action === 'edit') return set({ open: row.id, mode: 'edit' })
    setModal({ kind: action, product: row.record })
  }
  const confirm = () => {
    const { kind, product } = modal
    const mutation = kind === 'archive' ? archive : restore
    mutation.mutate(product._id, {
      onSuccess: () => {
        toast.success(kind === 'archive' ? `${product.name} was archived.` : `${product.name} is back in Inventory.`)
        setModal(null)
      },
      onError: (error) => toast.error(errorMessage(error)),
    })
  }

  if (editing.error?.response?.status === 404) return <NotFound />

  return (
    <DashPage>
      <PageHeader
        eyebrow="Marketplace"
        title="Inventory"
        description="What Kaluppa sells: coffee for buyers, beans and fertilizer for farmers."
        actions={
          <Button onClick={() => set({ open: 'new', mode: null })} leftIcon={<IconPlus aria-hidden="true" className="size-4" strokeWidth={2} />}>
            Add product
          </Button>
        }
      />
      <DataTable
        query={query}
        ariaLabel="Products"
        columns={[
          { key: 'product', label: 'Product', render: productCell },
          { key: 'category', label: 'Category', kind: 'pill' },
          { key: 'unit', label: 'Unit' },
          { key: 'price', label: 'Price', align: 'right' },
          { key: 'stock', label: 'Stock', align: 'right' },
          { key: 'status', label: 'Status', kind: 'pill' },
        ]}
        rows={list.data?.items.map(toRow)}
        status={STATUS}
        filters={FILTERS}
        onAction={onAction}
        total={list.data?.meta.total ?? 0}
        pageSize={PAGE_SIZE}
        loading={list.isPending}
        error={list.isError}
        onRetry={() => list.refetch()}
        emptyState={
          params.status === 'archived'
            ? { title: 'Nothing archived', text: 'Archived products show up here. You can restore them.' }
            : { title: 'No products yet', text: 'Add coffee for buyers, or beans and fertilizer for farmers.' }
        }
        searchPlaceholder="Search product name"
        minWidth={960}
        selectedId={params.open}
      />
      <InventoryForm open={params.open === 'new' || Boolean(editing.data)} product={editing.data ?? null} onClose={close} />
      <ConfirmModal
        open={modal?.kind === 'archive'}
        variant="archive"
        title={`Archive ${modal?.product.name ?? 'this product'}?`}
        confirmLabel="Archive product"
        cancelLabel="Keep"
        pending={archive.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        It leaves the store and this list. Past orders keep their copy of the product. You can restore it.
      </ConfirmModal>
      <ConfirmModal
        open={modal?.kind === 'restore'}
        variant="restore"
        title={`Restore ${modal?.product.name ?? 'this product'}?`}
        confirmLabel="Restore product"
        cancelLabel="Keep archived"
        pending={restore.isPending}
        onClose={() => setModal(null)}
        onConfirm={confirm}
      >
        It comes back to Inventory and, if it’s active, to the store.
      </ConfirmModal>
    </DashPage>
  )
}
