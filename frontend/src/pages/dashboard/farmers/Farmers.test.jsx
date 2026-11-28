// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Farmers } from './Farmers'

const createFarmer = vi.fn(async (body) => ({ id: 'f9', name: `${body.firstName} ${body.lastName}`, firstName: body.firstName }))
vi.mock('@/services/farmer.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listFarmers: vi.fn(async () => ({ items: [], meta: { page: 1, limit: 10, total: 0 } })),
  createFarmer: (body) => createFarmer(body),
}))
vi.mock('@/services/auth.service', async (importOriginal) => ({
  ...(await importOriginal()),
  usernameSuggestions: vi.fn(async () => ['ernestoj', 'ernesto.j', 'ejavier']),
  usernameAvailability: vi.fn(async (username) => ({ username, available: username !== 'ernesto' })),
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
  it('adds a farmer with a required email and the read-only default password (Change 08)', async () => {
    renderPage()
    const add = await screen.findByRole('button', { name: 'Add farmer' })
    await waitFor(() => expect(add.disabled).toBe(false))
    fireEvent.click(add)
    await screen.findByText('Santa Cruz Coffee Growers', { selector: 'strong' })
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ernesto' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Javier' } })
    // Suggestions come from the name; a taken username blocks saving until a chip is picked.
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ernesto' } })
    await screen.findByText('@ernesto is taken. Try a suggestion.', {}, { timeout: 2000 })
    fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create farmer' }))
    await new Promise((r) => setTimeout(r, 50))
    expect(createFarmer).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: '@ernesto.j' }, { timeout: 2000 }))
    expect(screen.getByLabelText('Username').value).toBe('ernesto.j')
    await screen.findByText('@ernesto.j is available', {}, { timeout: 2000 })
    fireEvent.change(screen.getByLabelText('Contact number'), { target: { value: '09171234567' } })
    expect(screen.getByLabelText('Password').value).toBe('KapeKonek@123')
    expect(screen.getByLabelText('Password').readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create farmer' }))
    await screen.findByText('Enter a valid email address')
    expect(createFarmer).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ernesto@gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create farmer' }))
    await waitFor(() => expect(createFarmer).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Ernesto', username: 'ernesto.j', email: 'ernesto@gmail.com', contactNumber: '09171234567' })))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add a farmer' })).toBeNull())
  })
})
