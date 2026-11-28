// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { AssociationWindow } from './AssociationWindow'

vi.mock('@/services/association.service', async (importOriginal) => ({ ...(await importOriginal()), listAssociationOptions: vi.fn(async () => []) }))

afterEach(cleanup)
beforeEach(() => sessionStorage.clear())

const show = (farmerStatus) => {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'f1', farmerStatus, emailVerifiedAt: '2026-11-01' }, roles: ['farmer'], permissions: ['association.request'] } })
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AssociationWindow />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AssociationWindow', () => {
  it('opens on sign-in for a farmer with no association, and Skip for now closes it for the session', () => {
    show('none')
    expect(screen.getByRole('dialog', { name: 'Join your association' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    show('none')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('stays closed while a request is waiting or after a rejection', () => {
    show('pending')
    expect(screen.queryByRole('dialog')).toBeNull()
    cleanup()
    show('rejected')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
