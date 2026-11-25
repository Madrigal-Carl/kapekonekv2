// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Products } from './Products'

const categories = vi.hoisted(() => ({ value: [] }))
const listProducts = vi.hoisted(() => vi.fn(async () => ({ items: [], meta: { total: 0, hasMore: false, nextCursor: null } })))
vi.mock('@/services/catalog.service', () => ({ listCategories: vi.fn(async () => categories.value), listProducts }))

beforeAll(() => {
  globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} }
})
afterEach(() => {
  cleanup()
  listProducts.mockClear()
})

const renderPage = (url = '/products') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Products />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const FERTILIZER = { _id: 'c2', name: 'Fertilizer', slug: 'fertilizer', hasVariety: false, hasCoffeeType: false }
const SEEDLINGS = { _id: 'c3', name: 'Seedlings', slug: 'seedlings', hasVariety: true, hasCoffeeType: false }
const COFFEE = { _id: 'c1', name: 'Coffee', slug: 'coffee', hasVariety: true, hasCoffeeType: true }

describe('Products', () => {
  it('shows a farmer their first category and lets them switch; no coffee filters', async () => {
    categories.value = [FERTILIZER, SEEDLINGS]
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Fertilizer' })).toBeTruthy()
    await vi.waitFor(() => expect(listProducts).toHaveBeenCalledWith(expect.objectContaining({ category: 'fertilizer' })))
    expect(screen.queryByText('Coffee type')).toBeNull()
    expect(screen.queryByText('Variety')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Seedlings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Seedlings' })).toBeTruthy()
    expect(screen.getByText('Variety')).toBeTruthy()
  })

  it('keeps the buyer’s coffee page as it was', async () => {
    categories.value = [COFFEE]
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Coffee' })).toBeTruthy()
    expect(screen.getByText('Coffee type')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'Category' })).toBeNull()
  })
})
