// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Farmers } from './Farmers'

const PASSWORD = 'kape-7Q4m-ub9X'
const createFarmer = vi.fn(async (body) => ({ farmer: { id: 'f9', name: `${body.firstName} ${body.lastName}`, firstName: body.firstName }, temporaryPassword: PASSWORD }))
vi.mock('@/services/farmer.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listFarmers: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 10, total: 0 } })),
  createFarmer: (body) => createFarmer(body),
}))
vi.mock('@/services/dashboard.service', async (importOriginal) => ({
  ...(await importOriginal()),
  getOrgCard: vi.fn(async () => ({ kind: 'group_manager', association: { id: 'a1', name: 'Santa Cruz Coffee Growers' }, farmers: 0, waiting: 0 })),
}))

afterEach(cleanup)

const renderPage = () => {
  useAuthStore.setState({
    status: 'ready',
    session: { user: { id: 'gm', firstName: 'Liza', lastName: 'Ramos', emailVerifiedAt: null }, roles: ['group_manager'], permissions: ['dashboard.view', 'farmers.manage', 'farmers.approve'] },
  })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/dashboard/farmers']}>
        <Farmers />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Farmers', () => {
  it('shows a new farmer’s temporary password once, and never again after it closes', async () => {
    renderPage()
    const add = await screen.findByRole('button', { name: 'Add farmer' })
    await waitFor(() => expect(add.disabled).toBe(false))
    fireEvent.click(add)
    await screen.findByText('Santa Cruz Coffee Growers', { selector: 'strong' })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ernesto' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Javier' } })
    expect(screen.getByLabelText('Username').value).toBe('ernesto.javier')
    fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create farmer' }))

    const dialog = await screen.findByRole('dialog', { name: 'Account created' })
    expect(dialog.textContent).toContain(PASSWORD)
    expect(dialog.textContent).toContain('Give Ernesto this temporary password')
    expect(createFarmer).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ernesto', username: 'ernesto.javier', email: null, contactNumber: '09171234567' }))

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Account created' })).toBeNull())
    expect(document.body.textContent).not.toContain(PASSWORD)

    // Opening the form again starts clean; the password is gone for good.
    fireEvent.click(screen.getByRole('button', { name: 'Add farmer' }))
    await screen.findByRole('dialog', { name: 'Add a farmer' })
    expect(document.body.textContent).not.toContain(PASSWORD)
  })
})
