// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMapFarms } from '@/services/record.service'
import { useAuthStore } from '@/stores/auth.store'
import { FarmMap } from './FarmMap'

const FARMS = [
  {
    id: 'f1', propertyNumber: 'TCT-2026-0011', lotNumber: 'Lot 12-B', ownerType: 'farmer', owner: { id: 'u1', name: 'Rodel Mendoza' },
    association: { id: 'a1', name: 'Santa Cruz Coffee Growers' }, managedBy: null, sizeHa: 1.2, municipality: 'Santa Cruz', barangay: 'Pantayin',
    location: { lat: 13.47, lng: 122.03 }, treeCount: 240, varieties: [{ variety: 'liberica', count: 140 }, { variety: 'excelsa', count: 100 }],
    stages: [{ stage: 'fruiting', pct: 60 }, { stage: 'growing', pct: 40 }], lastHarvest: { yieldKg: 110, harvestedAt: '2026-11-18' },
  },
  {
    id: 'f6', propertyNumber: 'TCT-2026-0002', lotNumber: 'Kaluppa Demo Farm', ownerType: 'kaluppa', owner: { id: 'k', name: 'Kaluppa' },
    association: { id: 'a1', name: 'Santa Cruz Coffee Growers' }, managedBy: { id: 'm', name: 'Liza Ramos' }, sizeHa: 3.5, municipality: 'Santa Cruz',
    barangay: 'Pantayin', location: { lat: 13.46, lng: 122.04 }, treeCount: 0, varieties: [], stages: [], lastHarvest: null,
  },
]

vi.mock('@/services/record.service', async (importOriginal) => ({
  ...(await importOriginal()),
  getMapFarms: vi.fn(async () => ({ farms: FARMS, branch: { name: 'Kaluppa', location: { lat: 13.467, lng: 122.044 } } })),
}))
vi.mock('@/services/association.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listAssociationOptions: vi.fn(async () => [{ id: 'a1', name: 'Santa Cruz Coffee Growers' }, { id: 'a2', name: 'Boac Highland Farmers' }]),
}))
vi.mock('@/services/dashboard.service', async (importOriginal) => ({ ...(await importOriginal()), getOrgCard: vi.fn(async () => null) }))
// Mapbox can't run in jsdom: the stand-in draws the pins as buttons and the popover.
vi.mock('@/components/map/MapPicker', () => ({
  MapPicker: ({ pins, onPin, popup }) => (
    <div>
      {pins.map((p) => <button key={p.id} type="button" aria-label={`pin ${p.label}`} onClick={() => onPin(p.id)} />)}
      {popup}
    </div>
  ),
}))

afterEach(cleanup)

const SESSIONS = {
  kaluppa: { roles: ['kaluppa'], permissions: ['dashboard.view', 'map.view', 'records.view_all', 'farmers.manage'] },
  farmer: { roles: ['farmer'], permissions: ['dashboard.view', 'map.view'] },
}
function renderAs(as, url = '/dashboard/farm-map') {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Ana', lastName: 'V', emailVerifiedAt: '2026-01-01' }, ...SESSIONS[as] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <FarmMap />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('FarmMap', () => {
  it('Kaluppa gets the association filter and the side list with totals', async () => {
    renderAs('kaluppa')
    expect(await screen.findByRole('heading', { name: '2 farms' })).toBeTruthy()
    expect(screen.getByText('4.7 ha · 240 trees')).toBeTruthy()
    expect(screen.getByRole('button', { name: /All associations/ })).toBeTruthy()
    expect(screen.getByText('Kaluppa farm · Pantayin, Santa Cruz')).toBeTruthy()
  })

  it('a farmer has no association filter', async () => {
    renderAs('farmer')
    await screen.findByRole('heading', { name: '2 farms' })
    expect(screen.queryByRole('button', { name: /All associations/ })).toBeNull()
    expect(screen.getByText('Your farms on the map. Click a pin for details.')).toBeTruthy()
  })

  it('picking a farm in the list opens its popover with the details and "Open farm"', async () => {
    renderAs('kaluppa')
    fireEvent.click(await within(screen.getByRole('region', { name: 'Farms' })).findByRole('button', { name: /TCT-2026-0011/ }))
    const pop = screen.getByRole('dialog', { name: 'Lot 12-B · Rodel Mendoza' })
    expect(within(pop).getByText('240 · 140 Liberica, 100 Excelsa')).toBeTruthy()
    expect(within(pop).getByText('Fruiting 60% · Growing 40%')).toBeTruthy()
    expect(within(pop).getByText('Nov 18 · 110 kg')).toBeTruthy()
    expect(within(pop).queryByText('Managed by')).toBeNull()
    expect(within(pop).getByRole('link', { name: 'Open farm' }).getAttribute('href')).toBe('/dashboard/farms?open=f1')
    fireEvent.click(within(pop).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('a Kaluppa farm pin shows Managed by', async () => {
    renderAs('kaluppa')
    fireEvent.click(await screen.findByRole('button', { name: 'pin TCT-2026-0002, Kaluppa Demo Farm' }))
    const pop = screen.getByRole('dialog', { name: 'Kaluppa Demo Farm · Kaluppa farm' })
    expect(within(pop).getByText('Liza Ramos')).toBeTruthy()
  })

  it('sends the filters from the URL', async () => {
    renderAs('kaluppa', '/dashboard/farm-map?municipality=Boac&variety=robusta')
    await screen.findByRole('heading', { name: '2 farms' })
    expect(getMapFarms).toHaveBeenLastCalledWith({ association: undefined, municipality: 'Boac', variety: 'robusta' })
  })
})
