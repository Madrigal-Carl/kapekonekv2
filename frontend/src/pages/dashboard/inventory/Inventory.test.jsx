// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Inventory } from './Inventory'

const photo = (n) => ({ url: `https://res.cloudinary.com/test/image/upload/v1/p${n}.jpg`, publicId: `kapekonek/product-photos/k/p${n}`, isThumbnail: n === 0 })
const BARAKO = {
  _id: 'p1', name: 'Barako Medium Roast', slug: 'barako-medium-roast', category: { slug: 'coffee', name: 'Coffee' }, variety: 'liberica', coffeeType: 'roasted_beans',
  unit: 'pack', unitLabel: '250 g', priceCentavos: 26_000, stock: 38, stockState: 'in', description: 'Chocolatey.', photos: [photo(0), photo(1), photo(2)],
  isFeatured: true, isActive: true, archivedAt: null,
}
const UREA = { ...BARAKO, _id: 'p2', name: 'Urea 46-0-0', category: { slug: 'fertilizer', name: 'Fertilizer' }, variety: null, coffeeType: null, unit: 'sack', unitLabel: '50 kg sack', stock: 6, stockState: 'low', isFeatured: false }
const byId = { p1: BARAKO, p2: UREA }

const updateProduct = vi.hoisted(() => vi.fn(async (body) => body))
const archiveProduct = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('@/services/inventory.service', () => ({
  listInventory: vi.fn(async () => ({ items: [BARAKO, UREA], meta: { page: 1, limit: 10, total: 2 } })),
  getInventoryProduct: vi.fn(async (id) => byId[id]),
  createProduct: vi.fn(),
  updateProduct,
  archiveProduct,
  restoreProduct: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(url) {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'k', firstName: 'Ana', lastName: 'Villanueva', emailVerifiedAt: '2026-01-01' }, roles: ['kaluppa'], permissions: ['dashboard.view'] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Inventory />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Inventory', () => {
  it('lists products with category, unit, stock state and Landing', async () => {
    renderAt('/dashboard/inventory')
    const table = await screen.findByRole('region', { name: 'Products' })
    expect(await within(table).findByText('38 packs')).toBeTruthy()
    expect(within(table).getByText('6 sacks')).toBeTruthy()
    expect(within(table).getByText('Low stock')).toBeTruthy()
    expect(within(table).getByText('pack (250 g)')).toBeTruthy()
    expect(within(table).getByText('Featured')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add product' })).toBeTruthy()
  })

  it('picks another photo as the thumbnail and saves it', async () => {
    renderAt('/dashboard/inventory?open=p1&mode=edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Barako Medium Roast' })
    const third = await within(dialog).findByRole('button', { name: /Photo 3/ })
    expect(third.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(third)
    expect(third.getAttribute('aria-pressed')).toBe('true')
    expect(within(dialog).getByRole('button', { name: /Photo 1/ }).getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await vi.waitFor(() => expect(updateProduct).toHaveBeenCalled())
    const body = updateProduct.mock.calls[0][0]
    expect(body).toMatchObject({ id: 'p1', priceCentavos: 26_000, category: 'coffee', unit: 'pack' })
    expect(body.photos.map((p) => p.isThumbnail)).toEqual([false, false, true])
  })

  it('removing the thumbnail makes the first remaining photo the thumbnail', async () => {
    renderAt('/dashboard/inventory?open=p1&mode=edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Barako Medium Roast' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Remove photo 1' }))
    expect(within(dialog).getByRole('button', { name: /Photo 1/ }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows no coffee fields for fertilizer and keeps Featured off', async () => {
    renderAt('/dashboard/inventory?open=p2&mode=edit')
    const dialog = await screen.findByRole('dialog', { name: 'Edit Urea 46-0-0' })
    await within(dialog).findByRole('button', { name: /Unit/ })
    expect(within(dialog).queryByRole('button', { name: /Coffee type/ })).toBeNull()
    const featured = within(dialog).getByRole('switch', { name: 'Featured on the landing page' })
    expect(featured.getAttribute('aria-checked')).toBe('false')
    expect(featured.disabled).toBe(true)
  })

  it('archives from the row action after the modal', async () => {
    renderAt('/dashboard/inventory')
    const table = await screen.findByRole('region', { name: 'Products' })
    fireEvent.click((await within(table).findAllByRole('button', { name: /Archive Barako/ }))[0])
    const modal = await screen.findByRole('dialog')
    expect(within(modal).getByText('Archive Barako Medium Roast?')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Archive product' }))
    await vi.waitFor(() => expect(archiveProduct.mock.calls[0]?.[0]).toBe('p1'))
  })
})
