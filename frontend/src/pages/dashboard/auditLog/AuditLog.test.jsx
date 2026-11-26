// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listAuditLog } from '@/services/auditLog.service'
import { useAuthStore } from '@/stores/auth.store'
import { AuditLog } from './AuditLog'

const ENTRIES = [
  {
    id: 'e1', code: 'AUD-0000AAAA', at: '2026-11-23T01:14:00Z', actor: { id: 'k', name: 'Ana Villanueva', initials: 'AV', avatarUrl: null }, actorRole: 'kaluppa',
    area: 'beans', action: 'approve', entityType: 'bean_listing', entityId: 'b1', entityLabel: 'BN-2611-0040',
    changes: [{ field: 'status', from: 'pending', to: 'approved' }, { field: 'expiresAt', from: null, to: '2026-11-27' }],
  },
  { id: 'e2', code: 'AUD-0000BBBB', at: '2026-11-19T09:15:00Z', actor: null, actorRole: 'system', area: 'beans', action: 'expire', entityType: 'bean_listing', entityId: 'b2', entityLabel: 'BN-2611-0036', changes: [] },
]

vi.mock('@/services/auditLog.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listAuditLog: vi.fn(async () => ({ items: ENTRIES, meta: { page: 1, limit: 10, total: 2 } })),
  getAuditEntry: vi.fn(async (id) => ENTRIES.find((e) => e.id === id)),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(url = '/dashboard/audit-log') {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'k', firstName: 'Ana', lastName: 'V', emailVerifiedAt: '2026-01-01' }, roles: ['kaluppa'], permissions: ['dashboard.view', 'audit.view'] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <AuditLog />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AuditLog', () => {
  it('lists who, area, what, record and the changed fields', async () => {
    renderAt()
    expect((await screen.findAllByText('Approved the listing')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('BN-2611-0040').length).toBeGreaterThan(0)
    expect(screen.getAllByText('status, expiresAt').length).toBeGreaterThan(0)
    expect(screen.getAllByText('System').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Expired the listing after 7 days').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href')).toMatch(/\/audit-logs\/export\.csv/)
  })

  it('opens the diff drawer from ?open=', async () => {
    renderAt('/dashboard/audit-log?open=e1&mode=view')
    const drawer = await screen.findByRole('dialog', { name: /Approved the listing · BN-2611-0040/ })
    expect(within(drawer).getByText('AUD-0000AAAA')).toBeTruthy()
    const row = within(drawer).getByRole('rowheader', { name: 'status' }).closest('tr')
    expect(within(row).getByText('pending').tagName).toBe('DEL')
    expect(within(row).getByText('approved')).toBeTruthy()
    expect(within(drawer).getByText('Passwords and uploaded documents are never stored in the log.')).toBeTruthy()
  })

  it('sends the filters and the record from the URL; "Show every entry" drops the record', async () => {
    renderAt('/dashboard/audit-log?area=beans&role=system&entity=b2')
    await screen.findAllByText('Approved the listing')
    expect(listAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ area: 'beans', role: 'system', entity: 'b2', page: 1 }))
    fireEvent.click(screen.getByRole('button', { name: 'Show every entry' }))
    await vi.waitFor(() => expect(listAuditLog).toHaveBeenLastCalledWith(expect.objectContaining({ entity: undefined })))
  })
})
