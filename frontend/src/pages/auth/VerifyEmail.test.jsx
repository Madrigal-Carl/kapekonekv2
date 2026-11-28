// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { VerifyEmail } from './VerifyEmail'

const addEmail = vi.fn()
vi.mock('@/services/auth.service', async (importOriginal) => ({ ...(await importOriginal()), addEmail: (body) => addEmail(body) }))

afterEach(cleanup)

const show = (user, roles) => {
  useAuthStore.setState({ status: 'ready', session: { user: { emailVerifiedAt: null, mustVerifyEmail: true, ...user }, roles, permissions: [] } })
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <VerifyEmail />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('VerifyEmail, created variant (Change 08)', () => {
  it('names who made the farmer account, and where to get help', () => {
    show({ email: 'ernesto@gmail.com', createdBy: { name: 'Liza Ramos', isKaluppa: false }, associationName: 'Santa Cruz Coffee Growers' }, ['farmer'])
    expect(screen.getByText('Liza Ramos created a farmer account for you in Santa Cruz Coffee Growers. Verify your email before you can use it.')).toBeTruthy()
    expect(document.body.textContent).toContain('Your dashboard stays locked until you open it.')
    expect(document.body.textContent).toContain('Wrong email? Ask your Group Manager to fix it.')
    expect(screen.getByRole('link', { name: 'Contact Kaluppa →' }).getAttribute('href')).toBe('/contact')
  })

  it('a Group Manager made by Kaluppa asks Kaluppa', () => {
    show({ email: 'celso@gmail.com', createdBy: { name: 'Kaluppa', isKaluppa: true } }, ['group_manager'])
    expect(screen.getByText('Kaluppa created a Group Manager account for you. Verify your email before you can use it.')).toBeTruthy()
    expect(document.body.textContent).toContain('Wrong email? Ask Kaluppa to fix it.')
  })

  it('a username-only account adds its email first', async () => {
    addEmail.mockResolvedValue({ user: { email: 'old@gmail.com', mustVerifyEmail: true, createdBy: { name: 'Liza Ramos', isKaluppa: false } }, roles: ['farmer'], permissions: [] })
    show({ email: null, createdBy: { name: 'Liza Ramos', isKaluppa: false } }, ['farmer'])
    expect(screen.getByRole('heading', { name: 'Add your email' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'old@gmail.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send verification link' }))
    await waitFor(() => expect(addEmail).toHaveBeenCalledWith({ email: 'old@gmail.com' }))
    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeTruthy()
  })
})
