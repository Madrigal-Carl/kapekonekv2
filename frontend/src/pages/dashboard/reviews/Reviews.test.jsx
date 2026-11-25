// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Reviews } from './Reviews'

const BASE = {
  rating: 3, comment: 'Good beans but a few were broken. Hoping the sorting is better next time, really hoping.', createdAt: '2026-11-13T02:00:00Z', editedAt: null,
  product: { id: 'p1', name: 'Excelsa Green Beans', slug: 'excelsa-green-beans', image: null }, reviewer: { id: 'u1', name: 'Jun Lopez', role: 'buyer' },
  order: { id: 'o1', orderNumber: 'KK-20261108-0021' }, reply: null, hidden: null,
}
const byId = {
  r1: { ...BASE, id: 'r1' },
  r2: { ...BASE, id: 'r2', rating: 5, reviewer: { id: 'u2', name: 'Marites Abad', role: 'farmer' }, reply: { body: 'Salamat po!', at: '2026-11-14T02:00:00Z', editedAt: null, by: { firstName: 'Ana', name: 'Ana Villanueva' } } },
  r3: { ...BASE, id: 'r3', hidden: { at: '2026-11-20T02:00:00Z', reason: 'Mentions a phone number', by: { name: 'Ana Villanueva' } } },
}

const saveReply = vi.hoisted(() => vi.fn(async ({ id, body }) => ({ ...byId[id], reply: { body, at: '2026-11-25T00:00:00Z', editedAt: null, by: { firstName: 'Ana' } } })))
const hideReview = vi.hoisted(() => vi.fn(async ({ id, reason }) => ({ ...byId[id], hidden: { at: '2026-11-25T00:00:00Z', reason, by: { name: 'Ana Villanueva' } } })))
vi.mock('@/services/reviewModeration.service', () => ({
  listAdminReviews: vi.fn(async () => ({ items: Object.values(byId), meta: { page: 1, limit: 10, total: 3 } })),
  listReviewedProducts: vi.fn(async () => [{ id: 'p1', name: 'Excelsa Green Beans' }]),
  getAdminReview: vi.fn(async (id) => byId[id]),
  saveReply,
  deleteReply: vi.fn(),
  hideReview,
  unhideReview: vi.fn(),
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
        <Reviews />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Reviews', () => {
  it('lists reviews with reviewer type, an excerpt, reply and visibility pills', async () => {
    renderAt('/dashboard/reviews')
    const table = await screen.findByRole('region', { name: 'Reviews' })
    expect(await within(table).findByText('Marites Abad')).toBeTruthy()
    expect(within(table).getByText('Farmer')).toBeTruthy()
    expect(within(table).getAllByText('Needs reply')).toHaveLength(2)
    expect(within(table).getByText('Replied')).toBeTruthy()
    expect(within(table).getByText('Hidden')).toBeTruthy()
    expect(within(table).getAllByText(/…$/).length).toBeGreaterThan(0)
    const filters = within(table).getByRole('group', { name: 'Filters' })
    for (const name of [/Status/, /Product/, /Rating/, /Reply/]) expect(within(filters).getByRole('button', { name })).toBeTruthy()
  })

  it('posts a public reply from the drawer', async () => {
    renderAt('/dashboard/reviews?open=r1')
    const dialog = await screen.findByRole('dialog', { name: '3-star review of Excelsa Green Beans' })
    fireEvent.change(await within(dialog).findByLabelText(/Public reply/), { target: { value: 'Thanks, Jun! We are checking every bag.' } })
    expect(within(dialog).getByText(/39 \/ 1000/)).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save reply' }))
    await vi.waitFor(() => expect(saveReply.mock.calls[0]?.[0]).toEqual({ id: 'r1', body: 'Thanks, Jun! We are checking every bag.' }))
    expect(await within(dialog).findByText('Kaluppa · Ana')).toBeTruthy()
  })

  it('shows the reply with Edit and Delete', async () => {
    renderAt('/dashboard/reviews?open=r2')
    const dialog = await screen.findByRole('dialog', { name: '5-star review of Excelsa Green Beans' })
    expect(await within(dialog).findByText('Salamat po!')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit reply' }))
    expect(within(dialog).getByLabelText(/Public reply/).value).toBe('Salamat po!')
  })

  it('hides with a required reason', async () => {
    renderAt('/dashboard/reviews?open=r1')
    const dialog = await screen.findByRole('dialog', { name: '3-star review of Excelsa Green Beans' })
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Hide review' }))
    const modal = await screen.findByRole('dialog', { name: 'Hide this review?' })
    const confirm = within(modal).getByRole('button', { name: 'Hide review' })
    expect(confirm.disabled).toBe(true)
    fireEvent.change(within(modal).getByRole('textbox'), { target: { value: 'Contains a phone number' } })
    fireEvent.click(confirm)
    await vi.waitFor(() => expect(hideReview.mock.calls[0]?.[0]).toEqual({ id: 'r1', reason: 'Contains a phone number' }))
  })

  it('explains a hidden review', async () => {
    renderAt('/dashboard/reviews?open=r3')
    const dialog = await screen.findByRole('dialog', { name: '3-star review of Excelsa Green Beans' })
    expect((await within(dialog).findByRole('status')).textContent).toContain('Reason: “Mentions a phone number”')
    expect(within(dialog).getByRole('button', { name: 'Show again' })).toBeTruthy()
  })
})
