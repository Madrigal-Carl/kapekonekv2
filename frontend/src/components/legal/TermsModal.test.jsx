// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Register } from '@/pages/auth/Register'
import { useAuthStore } from '@/stores/auth.store'
import { TermsGate } from './TermsGate'
import { TermsModal } from './TermsModal'

const register = vi.hoisted(() => vi.fn())
vi.mock('@/services/auth.service', async (importOriginal) => ({ ...(await importOriginal()), register }))
vi.mock('@/services/legal.service', () => ({
  acceptTerms: vi.fn(async () => ({})),
  getCurrentLegal: vi.fn(async () => ({
    version: 1,
    updatedAt: '2026-11-28',
    terms: [{ heading: '1. Using KapeKonek', paragraphs: ['KapeKonek is Kaluppa’s marketplace.'] }],
    privacy: [{ heading: 'What we collect', paragraphs: ['Your name.'] }],
  })),
}))

afterEach(cleanup)
const wrap = (ui) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )

describe('Terms at sign-up (Change 09)', () => {
  it('blocks Create account until the box is ticked; each link opens its tab; I agree ticks the box', async () => {
    wrap(<Register />)
    const box = screen.getByLabelText('I agree to KapeKonek’s')
    expect(box.checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    const error = await screen.findByText('Please agree to the Terms and Conditions to create your account.')
    expect(error.getAttribute('role')).toBe('alert')
    expect(box.getAttribute('aria-invalid')).toBe('true')
    expect(register).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }))
    expect(await screen.findByRole('heading', { name: 'What we collect' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Privacy Policy' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('Version 1.0 · Last updated Nov 28, 2026')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box.checked).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Terms and Conditions' }))
    expect(await screen.findByRole('heading', { name: '1. Using KapeKonek' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'I agree' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box.checked).toBe(true)
    await waitFor(() => expect(screen.queryByText('Please agree to the Terms and Conditions to create your account.')).toBeNull())
  })

  it('accept mode can’t be dismissed and needs the box before Agree and continue', async () => {
    const onAgree = vi.fn()
    const onSignOut = vi.fn()
    wrap(<TermsModal open mode="accept" madeBy="Liza Ramos, your Group Manager" onAgree={onAgree} onSignOut={onSignOut} />)
    expect(screen.getByText('Your account was made for you by Liza Ramos, your Group Manager. Read and agree to these before you start using KapeKonek.')).toBeTruthy()
    await screen.findByRole('heading', { name: '1. Using KapeKonek' })
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    const agree = screen.getByRole('button', { name: 'Agree and continue' })
    expect(agree.disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('I’ve read and agree to the Terms and Conditions and the Privacy Policy.'))
    fireEvent.click(agree)
    expect(onAgree).toHaveBeenCalledWith(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalled()
  })

  it('the gate opens for a signed-in user on an older version, waits for email verification, and uses the "updated" copy', async () => {
    const show = (user) => {
      useAuthStore.setState({ status: 'ready', session: { user: { emailVerifiedAt: '2026-11-01', mustVerifyEmail: false, mustAcceptTerms: true, ...user }, roles: ['buyer'], permissions: [] } })
      return wrap(<TermsGate />)
    }
    show({ mustVerifyEmail: true })
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    show({})
    expect(await screen.findByText('We updated our terms. Read and agree to them to keep using KapeKonek.')).toBeTruthy()
    cleanup()
    show({ createdBy: { name: 'Kaluppa', isKaluppa: true } })
    expect(await screen.findByText(/^Your account was made for you by Kaluppa\./)).toBeTruthy()
    cleanup()
    show({ mustAcceptTerms: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
