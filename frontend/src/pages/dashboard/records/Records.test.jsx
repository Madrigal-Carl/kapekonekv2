// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { todayKey } from '@/schemas/rules'
import { useAuthStore } from '@/stores/auth.store'
import { Farms } from './Farms'
import { HarvestForm } from './HarvestForm'
import { Trees } from './Trees'

const FARM = {
  id: 'farm1', propertyNumber: 'TCT-2026-0001', ownerType: 'farmer', owner: { id: 'u1', name: 'Ana Farmer' },
  association: { id: 'a1', name: 'Santa Cruz Coffee Growers' }, managedBy: null, assignedFarmers: [], sizeHa: 1.2,
  municipality: 'Santa Cruz', barangay: 'Pantayin', street: '', location: { lat: 13.47, lng: 122.03 }, status: 'active',
  canEdit: true, canAssignFarmers: false, canManageRecords: true, treeCount: 80, groupCount: 2, varieties: ['excelsa', 'liberica'], lastHarvest: null,
}
const page = (items, extra = {}) => ({ items, meta: { page: 1, limit: 10, total: items.length, ...extra } })
const notFound = Object.assign(new Error('Farm not found.'), { response: { status: 404, data: { message: 'Farm not found.' } } })

vi.mock('@/services/record.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listFarms: vi.fn(async () => page([FARM])),
  getFarm: vi.fn(async (id) => {
    if (id === 'farm1') return FARM
    throw notFound
  }),
  listTreeGroups: vi.fn(async () => page([], { stageTotals: { newly_planted: 10, fruiting: 1250 } })),
}))
vi.mock('@/services/farmer.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listFarmers: vi.fn(async () => page([{ id: 'u1', name: 'Ana Farmer' }])),
}))

afterEach(cleanup)

const SESSIONS = {
  farmer: { roles: ['farmer'], permissions: ['dashboard.view', 'farms.manage', 'trees.manage', 'harvests.manage'] },
  manager: { roles: ['group_manager'], permissions: ['dashboard.view', 'farmers.manage', 'farms.manage', 'trees.manage', 'harvests.manage'] },
}
function renderAt(ui, { as = 'farmer', url = '/' } = {}) {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Ana', lastName: 'Farmer', emailVerifiedAt: '2026-01-01' }, ...SESSIONS[as] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Farms', () => {
  it('a Group Manager sees the association copy, the Owner column and the Farmer filter', async () => {
    renderAt(<Farms />, { as: 'manager', url: '/dashboard/farms' })
    expect(await screen.findByRole('heading', { name: 'Farms in your association' })).toBeTruthy()
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /All farmers/ })).toBeTruthy()
  })

  it('a farmer sees “My farms” without an Owner column', async () => {
    renderAt(<Farms />, { url: '/dashboard/farms' })
    expect(await screen.findByRole('heading', { name: 'My farms' })).toBeTruthy()
    await screen.findAllByText('TCT-2026-0001')
    expect(screen.queryByText('Owner')).toBeNull()
  })

  it('a farm link outside your scope shows the 404 page', async () => {
    renderAt(<Farms />, { url: '/dashboard/farms?open=someone-elses' })
    expect(await screen.findByText('We couldn’t find that page'.replace('’', "'"))).toBeTruthy()
  })
})

describe('Trees', () => {
  it('shows trees per stage from the API, zeros included', async () => {
    renderAt(<Trees />, { url: '/dashboard/trees' })
    const tiles = await screen.findByRole('list', { name: 'Trees by stage' })
    await waitFor(() => expect(within(tiles).getByText('1,250')).toBeTruthy())
    expect(within(tiles).getAllByText('0')).toHaveLength(3)
  })
})

describe('HarvestForm', () => {
  it('keeps Variety disabled until a farm is picked, then lists only that farm’s varieties', async () => {
    renderAt(<HarvestForm open actsForFarmers={false} onClose={() => {}} />)
    const variety = await screen.findByRole('button', { name: /Variety/ })
    expect(variety.disabled).toBe(true)
    const date = screen.getByLabelText('Harvested on')
    expect(date.value).toBe(todayKey())
    expect(date.max).toBe(todayKey())
    fireEvent.click(screen.getByRole('button', { name: /^Farm/ }))
    fireEvent.click(screen.getByRole('option', { name: 'TCT-2026-0001 · Pantayin, Santa Cruz' }))
    expect(await screen.findByText('This farm has Excelsa and Liberica trees, so only those varieties are listed.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Variety/ }))
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Excelsa', 'Liberica'])
  })
})
