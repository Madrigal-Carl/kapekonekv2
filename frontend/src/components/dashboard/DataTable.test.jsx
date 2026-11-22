// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useTableParams } from '@/hooks/useTableParams'
import { DataTable } from './DataTable'

afterEach(cleanup)

const columns = [
  { key: 'name', label: 'Farmer', kind: 'person' },
  { key: 'status', label: 'Status', kind: 'pill' },
  { key: 'farm', label: 'Farm', kind: 'two-line' },
  { key: 'code', label: 'Code', kind: 'mono' },
]
const rows = [
  {
    id: 'u1',
    label: 'Rodel Mendoza',
    name: { name: 'Rodel Mendoza', sub: '@rodel.mendoza', initials: 'RM' },
    status: { label: 'Approved', tone: 'green' },
    farm: { main: 'Lot 12-B', sub: 'Santa Cruz' },
    code: 'TCT-2026-0014',
  },
]
const status = { label: 'Status', options: [{ value: '', label: 'All statuses' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }] }
const filters = [{ key: 'municipality', label: 'Municipality', options: [{ value: '', label: 'All municipalities' }, { value: 'Boac', label: 'Boac' }] }]

function Harness(props) {
  const query = useTableParams({})
  const { search } = useLocation()
  return (
    <>
      <output data-testid="url">{search}</output>
      <DataTable query={query} columns={columns} rows={rows} status={status} filters={filters} total={14} pageSize={6} actions={['view', 'edit']} searchPlaceholder="Search farmers" {...props} />
    </>
  )
}

const renderAt = (url = '/farmers', props) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Harness {...props} />
    </MemoryRouter>,
  )
const url = () => screen.getByTestId('url').textContent

function pick(name, option) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }))
  fireEvent.click(screen.getByRole('option', { name: option }))
}

describe('DataTable', () => {
  it('puts Status first among the filters and round-trips filters and page through the URL', () => {
    renderAt('/farmers?page=2')
    const group = screen.getByRole('group', { name: 'Filters' })
    const [first, second] = within(group).getAllByRole('button')
    expect(first).toBe(within(group).getByRole('button', { name: 'Status All statuses' }))
    expect(second).toBe(within(group).getByRole('button', { name: 'Municipality All municipalities' }))
    pick('Status', 'Approved')
    expect(url()).toBe('?status=approved')
    pick('Municipality', 'Boac')
    expect(url()).toBe('?status=approved&municipality=Boac')
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(url()).toBe('?status=approved&municipality=Boac&page=3')
    expect(screen.getByText('Showing 13–14 of 14')).toBeTruthy()
  })

  it('Clear filters resets every filter but the search', () => {
    renderAt('/farmers?q=rodel&status=approved&municipality=Boac')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(url()).toBe('?q=rodel')
    expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  })

  it('renders person, pill, two-line and mono cells, labelled for the card layout', () => {
    renderAt()
    const row = screen.getAllByRole('row')[1]
    const cells = within(row).getAllByRole('cell')
    expect(cells.map((c) => c.dataset.label)).toEqual(['Farmer', 'Status', 'Farm', 'Code', 'Actions'])
    expect(cells[0].textContent).toBe('RMRodel Mendoza@rodel.mendoza')
    expect(within(cells[1]).getByText('Approved')).toBeTruthy()
    expect(cells[2].textContent).toBe('Lot 12-BSanta Cruz')
    expect(within(cells[3]).getByText('TCT-2026-0014').className).toContain('font-mono')
  })

  it('runs row actions with the row', () => {
    const onAction = vi.fn()
    renderAt('/farmers', { onAction })
    fireEvent.click(screen.getByRole('button', { name: 'Edit Rodel Mendoza' }))
    expect(onAction).toHaveBeenCalledWith('edit', rows[0])
  })

  it('shows skeleton rows while loading, an error with retry, and two kinds of empty', () => {
    const { unmount } = renderAt('/farmers', { loading: true, rows: undefined })
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true')
    unmount()
    const onRetry = vi.fn()
    renderAt('/farmers', { error: true, onRetry, rows: undefined })
    fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalled()
    cleanup()
    renderAt('/farmers', { rows: [], total: 0, emptyState: { title: 'No farmers yet', text: 'Add your first farmer.' } })
    expect(screen.getByText('No farmers yet')).toBeTruthy()
    cleanup()
    renderAt('/farmers?q=zzz', { rows: [], total: 0, emptyState: { title: 'No farmers yet' } })
    expect(screen.getByText('Nothing matches “zzz”')).toBeTruthy()
    expect(screen.getByText('No results')).toBeTruthy()
  })
})
