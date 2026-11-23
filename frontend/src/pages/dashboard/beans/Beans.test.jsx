// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Beans } from './Beans'

const photo = { url: 'https://res.cloudinary.com/test/image/upload/v1/a.jpg', publicId: 'kapekonek/bean-photos/me/a' }
const LISTING = {
  id: 'b1', listingNumber: 'BN-2611-0042', farmer: { id: 'f1', name: 'Joy Lacsamana' }, association: { id: 'a1', name: 'Santa Cruz Coffee Growers' },
  recordedBy: { id: 'f1', name: 'Joy Lacsamana' }, variety: 'liberica', form: 'dried_cherry', weightKg: 2, pricePerKgCentavos: 18_000, amountCentavos: 36_000,
  photos: [photo, photo], note: 'Sun-dried 12 days', status: 'pending', countsTowardCap: true, approvedAt: null, approvedBy: null, expiresAt: null,
  completion: null, rejection: null, cancellation: null, history: [{ action: 'listed', at: '2026-11-21T01:14:00Z', by: { name: 'Joy Lacsamana' }, byRole: 'farmer' }],
  createdAt: '2026-11-21T01:14:00Z', canEdit: true,
}
const TILES = { toReview: { count: 2, kg: 6 }, waiting: { count: 1, kg: 30, nextExpiresAt: '2026-11-27T06:00:00Z' }, boughtThisMonth: { kg: 230, paidCentavos: 5_418_000 }, averagePriceCentavos: 23_600 }

const cap = vi.hoisted(() => ({ value: { capKg: 5, usedKg: 3, leftKg: 2, approved: false } }))
const reject = vi.hoisted(() => vi.fn(async () => ({})))
vi.mock('@/services/bean.service', () => ({
  listBeans: vi.fn(async (params) => ({ items: [LISTING], meta: { page: 1, limit: 10, total: 1, ...(params.__kaluppa && {}) } })),
  getBean: vi.fn(async () => LISTING),
  getBeanCap: vi.fn(async () => cap.value),
  createBean: vi.fn(),
  updateBean: vi.fn(),
  approveBean: vi.fn(),
  rejectBean: reject,
  completeBean: vi.fn(),
  cancelBean: vi.fn(),
}))
vi.mock('@/services/farmer.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listFarmers: vi.fn(async () => ({ items: [{ id: 'f1', name: 'Joy Lacsamana' }], meta: { page: 1, limit: 50, total: 1 } })),
}))

afterEach(cleanup)

const SESSIONS = {
  farmer: { roles: ['farmer'], permissions: ['dashboard.view', 'beans.sell'] },
  manager: { roles: ['group_manager'], permissions: ['dashboard.view', 'farmers.manage', 'beans.sell'] },
  kaluppa: { roles: ['kaluppa'], permissions: ['dashboard.view', 'records.view_all', 'beans.review'] },
}
async function renderAs(as, url = '/dashboard/beans') {
  const { listBeans } = await import('@/services/bean.service')
  listBeans.mockImplementation(async () => ({ items: [LISTING], meta: { page: 1, limit: 10, total: 1, ...(as === 'kaluppa' && { tiles: TILES }) } }))
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Joy', lastName: 'Lacsamana', emailVerifiedAt: '2026-01-01' }, ...SESSIONS[as] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Beans />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Beans — farmer', () => {
  it('shows the selling limit and the four steps while unapproved', async () => {
    await renderAs('farmer')
    expect(await screen.findByRole('heading', { name: 'Sell beans to Kaluppa' })).toBeTruthy()
    const limit = await screen.findByRole('region', { name: 'Selling limit' })
    expect(within(limit).getByText('3 kg')).toBeTruthy()
    expect(within(limit).getByText('2 kg left')).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'How selling works' })).getAllByRole('listitem')).toHaveLength(4)
  })

  it('blocks Send above the cap and shows the live total', async () => {
    await renderAs('farmer')
    fireEvent.click(await screen.findByRole('button', { name: 'Sell beans' }))
    const drawer = await screen.findByRole('dialog', { name: 'List beans for Kaluppa' })
    expect(within(drawer).queryByRole('button', { name: /^Farmer/ })).toBeNull()
    fireEvent.change(within(drawer).getByLabelText('Weight (kg)'), { target: { value: '2.5' } })
    fireEvent.change(within(drawer).getByLabelText('Your price per kg (₱)'), { target: { value: '180' } })
    expect(await within(drawer).findByText('Over your limit. You can list up to 2 kg more until you’re approved.')).toBeTruthy()
    expect(within(drawer).getByText('₱450')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send to Kaluppa' }).disabled).toBe(true)
    fireEvent.change(within(drawer).getByLabelText('Weight (kg)'), { target: { value: '2' } })
    expect(await within(drawer).findByText('You can list up to 2 kg more until you’re approved.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send to Kaluppa' }).disabled).toBe(false)
  })

  it('hides the limit once approved', async () => {
    cap.value = { capKg: 5, usedKg: 0, leftKg: 5, approved: true }
    await renderAs('farmer')
    await screen.findAllByText('BN-2611-0042')
    expect(screen.queryByRole('region', { name: 'Selling limit' })).toBeNull()
    cap.value = { capKg: 5, usedKg: 3, leftKg: 2, approved: false }
  })

  it('a pending listing’s view says it waits for review and offers Cancel listing', async () => {
    await renderAs('farmer', '/dashboard/beans?open=b1')
    const drawer = await screen.findByRole('dialog', { name: '2 kg Liberica, dried cherry' })
    expect(within(drawer).getByText('Waiting for Kaluppa to review')).toBeTruthy()
    expect(within(drawer).getByRole('button', { name: 'Cancel listing' })).toBeTruthy()
  })
})

describe('Beans — a listing link outside the scope', () => {
  it('shows the 404 page', async () => {
    const { getBean } = await import('@/services/bean.service')
    getBean.mockRejectedValueOnce(Object.assign(new Error('Not found'), { response: { status: 404 } }))
    await renderAs('farmer', '/dashboard/beans?open=someone-else')
    expect(await screen.findByText("We couldn't find that page")).toBeTruthy()
  })
})

describe('Beans — Group Manager', () => {
  it('uses the association copy and asks which farmer', async () => {
    await renderAs('manager')
    expect(await screen.findByRole('heading', { name: 'Beans from your farmers' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Selling limit' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Sell beans' }))
    expect(await within(await screen.findByRole('dialog', { name: 'List beans for Kaluppa' })).findByRole('button', { name: /^Farmer/ })).toBeTruthy()
  })
})

describe('Beans — Kaluppa', () => {
  it('shows the tiles and no Sell button', async () => {
    await renderAs('kaluppa')
    expect(await screen.findByRole('heading', { name: 'Beans from farmers' })).toBeTruthy()
    const tiles = await screen.findByRole('list', { name: 'Bean summary' })
    expect(within(tiles).getByText('6 kg offered')).toBeTruthy()
    expect(within(tiles).getByText('230 kg')).toBeTruthy()
    expect(within(tiles).getByText('₱236/kg')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sell beans' })).toBeNull()
  })

  it('rejecting needs a reason of 5 or more characters', async () => {
    await renderAs('kaluppa', '/dashboard/beans?open=b1')
    const drawer = await screen.findByRole('dialog', { name: '2 kg Liberica, dried cherry' })
    expect(within(drawer).getByText('Within 5 kg limit')).toBeTruthy()
    fireEvent.click(within(drawer).getByRole('button', { name: 'Reject' }))
    fireEvent.change(within(drawer).getByLabelText('Reason · required'), { target: { value: 'wet' } })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Reject listing' }))
    expect(await within(drawer).findByText('Tell us a little more (at least 5 characters)')).toBeTruthy()
    expect(reject).not.toHaveBeenCalled()
  })
})
