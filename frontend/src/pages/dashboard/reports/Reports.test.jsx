// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveDownload } from '@/lib/download'
import { exportReport, getReport } from '@/services/report.service'
import { useAuthStore } from '@/stores/auth.store'
import { Reports } from './Reports'

const LABELS = ['Oct', 'Nov']
const DATA = {
  summary: {
    harvest: { kg: 340, previous: 50, pct: 580 }, beans: { kg: 17, paidCentavos: 306_000 }, farms: { count: 3, ha: 3.6 },
    farmers: { count: 2, newInPeriod: 2, waiting: 4 }, sales: { centavos: 100_000, count: 1 },
  },
  harvest: { labels: LABELS, series: [{ variety: 'liberica', values: [0, 100] }] },
  beans: { labels: LABELS, values: [0, 17] },
  sales: { labels: LABELS, values: [0, 100_000], count: 1 },
  trees: { total: 190, byStage: [{ stage: 'fruiting', count: 60 }, { stage: 'growing', count: 130 }] },
  breakdown: {
    kind: 'association',
    rows: [
      { name: 'Santa Cruz Growers', farmers: 1, farms: 2, trees: 60, harvestKg: 100, beansKg: 12, paidCentavos: 216_000 },
      { name: 'Kaluppa farms', farmers: null, farms: 2, trees: 100, harvestKg: 200, beansKg: null, paidCentavos: null },
    ],
  },
}

vi.mock('@/services/report.service', async (importOriginal) => ({
  ...(await importOriginal()),
  getReport: vi.fn(async (section) => DATA[section]),
  exportReport: vi.fn(async () => ({ blob: new Blob(['x']), filename: 'kapekonek-report-2026-11-27.pdf' })),
}))
vi.mock('@/lib/download', () => ({ fetchFile: vi.fn(), saveDownload: vi.fn() }))
vi.mock('@/services/association.service', async (importOriginal) => ({ ...(await importOriginal()), listAssociationOptions: vi.fn(async () => [{ id: 'a1', name: 'Santa Cruz Growers' }]) }))
vi.mock('@/services/dashboard.service', async (importOriginal) => ({ ...(await importOriginal()), getOrgCard: vi.fn(async () => ({ association: { name: 'Santa Cruz Growers' } })) }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const SESSIONS = {
  kaluppa: { roles: ['kaluppa'], permissions: ['dashboard.view', 'reports.view', 'records.view_all', 'orders.manage'] },
  manager: { roles: ['group_manager'], permissions: ['dashboard.view', 'reports.view', 'farmers.manage'] },
}
function renderAs(as, url = '/dashboard/reports') {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Ana', lastName: 'V', emailVerifiedAt: '2026-01-01' }, ...SESSIONS[as] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Reports />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Reports', () => {
  it('Kaluppa: KPIs, store sales, the association table and CSV links', async () => {
    renderAs('kaluppa')
    expect(await screen.findByText('▲ 580% vs previous period')).toBeTruthy()
    expect(screen.getByText('₱3,060 paid to farmers')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Store sales' })).toBeTruthy()
    const table = await screen.findByRole('region', { name: 'By association' })
    expect(await within(table).findByRole('rowheader', { name: 'Kaluppa farms' })).toBeTruthy()
    expect(within(table).getByText('₱2,160')).toBeTruthy()
    expect(screen.getByRole('button', { name: /All associations/ })).toBeTruthy()

    // Export: the table's button opens the modal with what's on screen; PDF sends the same filters with scope=table.
    fireEvent.click(within(table).getByRole('button', { name: 'Export' }))
    const modal = screen.getByRole('dialog', { name: 'Export “By association”' })
    expect(within(modal).getByRole('list', { name: 'Filters' }).textContent).toBe('Period:Last 12 monthsAssociation:All associations')
    expect(within(modal).getByRole('button', { name: 'Export CSV' })).toBeTruthy()
    fireEvent.click(within(modal).getByRole('radio', { name: /PDF/ }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Export PDF' }))
    await waitFor(() => expect(saveDownload).toHaveBeenCalled())
    expect(exportReport).toHaveBeenCalledWith('pdf', 'table', { period: 'last_12_months' })
    expect(screen.queryByRole('dialog', { name: 'Export “By association”' })).toBeNull()
  })

  it('a Group Manager: no sales request, no association filter, its association in the copy', async () => {
    renderAs('manager')
    expect(await screen.findByText('Harvests, beans and trees in Santa Cruz Growers.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Store sales' })).toBeNull()
    expect(screen.queryByRole('button', { name: /All associations/ })).toBeNull()
    expect(getReport.mock.calls.map(([section]) => section)).not.toContain('sales')
    expect(await screen.findByText('+4 waiting')).toBeTruthy()
  })

  it('sends the period and association from the URL', async () => {
    renderAs('kaluppa', '/dashboard/reports?period=last_year&association=a1')
    await screen.findByText('▲ 580% vs previous period')
    expect(getReport).toHaveBeenCalledWith('summary', { period: 'last_year', association: 'a1' })
  })
})
