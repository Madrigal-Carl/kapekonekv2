// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Settings } from './Settings'

vi.mock('@/components/map/MapPicker', () => ({ MapPicker: ({ note }) => <div data-testid="map">{note}</div> }))
vi.mock('@/services/setting.service', async (importOriginal) => ({
  ...(await importOriginal()),
  getLocations: vi.fn(async () => [{ name: 'Santa Cruz', center: { lat: 13.47, lng: 122.03 }, barangays: ['Pantayin', 'Banahaw'] }]),
}))
const HOURS = [...Array(6).fill({ open: true, from: '08:00', to: '17:00' }), { open: false, from: '08:00', to: '17:00' }]
const DATA = {
  branch: { name: 'Kaluppa', phone: '09178001122', street: '', barangay: 'Pantayin', municipality: 'Santa Cruz', location: { lat: 13.467, lng: 122.044 }, hours: HOURS },
  delivery: { baseFeeCentavos: 5000, baseKm: 3, perKmCentavos: 1000, roundUpToCentavos: 500, maxKm: 60, roadFactorFallback: 1.35, minBusinessDays: 3, maxBusinessDays: 5 },
  ewallet: { accounts: ['GCash', 'Maya'].map((provider) => ({ provider, accountName: 'Kaluppa Coffee', accountNumber: '0917 000 0000', showAtCheckout: true, qr: null })) },
}
const saveAdminSetting = vi.hoisted(() => vi.fn(async ({ body }) => body))
vi.mock('@/services/adminSetting.service', () => ({ getAdminSetting: vi.fn(async (section) => DATA[section]), saveAdminSetting }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(url) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Settings />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Settings', () => {
  it('shows the save bar only after a change, and saves the branch hours', async () => {
    renderAt('/dashboard/settings')
    expect(await screen.findByRole('tab', { name: 'Branch', selected: true })).toBeTruthy()
    const sunday = await screen.findByRole('switch', { name: 'Open on Sunday' })
    expect(screen.queryByText('You have unsaved changes.')).toBeNull()
    fireEvent.click(sunday)
    expect(await screen.findByText('You have unsaved changes.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await vi.waitFor(() => expect(saveAdminSetting).toHaveBeenCalled())
    const { section, body } = saveAdminSetting.mock.calls[0][0]
    expect(section).toBe('branch')
    expect(body.hours[6]).toEqual({ open: true, from: '08:00', to: '17:00' })
  }, 15_000) // a loaded full run takes ~7 s: several form fields and a save round-trip

  it('refuses a day that closes before it opens', async () => {
    renderAt('/dashboard/settings')
    fireEvent.change(await screen.findByLabelText('Monday closes'), { target: { value: '07:00' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Closing time must be after opening time')).toBeTruthy()
    expect(saveAdminSetting).not.toHaveBeenCalled()
  })

  it('works out a fee in Try it from the rules on screen', async () => {
    renderAt('/dashboard/settings?tab=delivery')
    const tryIt = await screen.findByRole('region', { name: 'Try it' })
    fireEvent.change(within(tryIt).getByLabelText('Road distance (km)'), { target: { value: '26.8' } })
    expect(within(tryIt).getByText('₱290')).toBeTruthy()
    expect(within(tryIt).getByText('₱50 for the first 3 km + ₱10 × 23.8 km, rounded up to ₱5')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Base fee (₱)'), { target: { value: '60' } })
    expect(within(tryIt).getByText('₱300')).toBeTruthy()
    fireEvent.change(within(tryIt).getByLabelText('Road distance (km)'), { target: { value: '61' } })
    expect(within(tryIt).getByText('Outside the area')).toBeTruthy()
    expect(within(tryIt).getByText('More than 60 km by road.')).toBeTruthy()
  })

  it('saves the fee rules in centavos', async () => {
    renderAt('/dashboard/settings?tab=delivery')
    fireEvent.change(await screen.findByLabelText('Per km after that (₱)'), { target: { value: '12.5' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }))
    await vi.waitFor(() => expect(saveAdminSetting).toHaveBeenCalled())
    expect(saveAdminSetting.mock.calls[0][0]).toEqual({
      section: 'delivery',
      body: { baseFeeCentavos: 5000, baseKm: 3, perKmCentavos: 1250, roundUpToCentavos: 500, maxKm: 60, minBusinessDays: 3, maxBusinessDays: 5 },
    })
  })

  it('hides a provider at checkout from the E-wallet tab', async () => {
    renderAt('/dashboard/settings?tab=ewallet')
    const maya = await screen.findByRole('region', { name: 'Maya' })
    // Both shown: the note and badges name what is on, from the saved accounts.
    expect(screen.getByRole('note').textContent).toContain('GCash and Maya are on.')
    expect(within(maya).getByText('Shown at checkout')).toBeTruthy()
    fireEvent.click(within(maya).getByRole('checkbox', { name: 'Show at checkout' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save changes' }))
    await vi.waitFor(() => expect(saveAdminSetting).toHaveBeenCalled())
    expect(saveAdminSetting.mock.calls[0][0].body.accounts.map((a) => a.showAtCheckout)).toEqual([true, false])
  })
})
