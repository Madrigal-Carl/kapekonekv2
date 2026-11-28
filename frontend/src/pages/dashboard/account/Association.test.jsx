// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Association } from './Association'

const doc = (name) => ({ url: `https://res.cloudinary.com/x/${name}`, publicId: name, name, bytes: 1_800_000, kind: 'image' })
const base = {
  association: { id: 'a1', name: 'Santa Cruz Coffee Growers', municipality: 'Santa Cruz', farmers: 18, farms: 26, groupManager: { id: 'g', name: 'Liza Ramos', contactNumber: '09175550142', email: 'liza@gmail.com' } },
  documents: { validId: doc('id.jpg'), landProof: doc('land.jpg') },
  transferRequest: null,
  cap: { capKg: 5, usedKg: 3, leftKg: 2 },
  records: { farms: 3, hectares: 2.6, harvestKgThisYear: 1240, soldKgThisYear: 410 },
  rejectionReason: null,
  requestedAt: '2026-11-21T00:00:00Z',
  approvedAt: null,
  approvedBy: null,
}
const request = { action: 'request', at: '2026-11-21T00:00:00Z', by: 'Rodel Mendoza' }
const PROFILES = {
  approved: { ...base, status: 'approved', approvedAt: '2026-10-14T00:00:00Z', history: [request, { action: 'approve', at: '2026-10-14T00:00:00Z', by: 'Liza Ramos' }] },
  pending: { ...base, status: 'pending', history: [request] },
  rejected: { ...base, status: 'rejected', rejectionReason: 'The proof of land ownership is blurry.', history: [request, { action: 'reject', at: '2026-11-19T00:00:00Z', by: 'Liza Ramos' }] },
  none: { ...base, status: 'none', association: null, documents: { validId: null, landProof: null }, history: [] },
}
let current
const withdrawRequest = vi.fn(async () => PROFILES.none)
vi.mock('@/services/farmer.service', async (importOriginal) => ({
  ...(await importOriginal()),
  getMyFarmerProfile: vi.fn(async () => current),
  withdrawRequest: () => withdrawRequest(),
}))
vi.mock('@/services/association.service', async (importOriginal) => ({
  ...(await importOriginal()),
  listAssociationOptions: vi.fn(async () => [{ id: 'a2', name: 'Boac Highland Farmers', municipality: 'Boac', groupManager: { name: 'Mario Santos' } }]),
}))

afterEach(cleanup)

const renderState = (status) => {
  current = PROFILES[status]
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Association />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Association', () => {
  it('approved: badge, stats, Group Manager, history, documents and the transfer form', async () => {
    renderState('approved')
    expect(await screen.findByText('Approved farmer')).toBeTruthy()
    expect(screen.getByText('Santa Cruz, Marinduque · 18 farmers · 26 farms')).toBeTruthy()
    expect(screen.getByText('No limit')).toBeTruthy()
    expect(screen.getByText('3 farms')).toBeTruthy()
    expect(screen.getByText('Your Group Manager')).toBeTruthy()
    expect(screen.getByText('Reviewed by Liza Ramos')).toBeTruthy()
    expect(screen.getAllByText('Accepted')).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Request transfer' })).toBeTruthy()
  })

  it('pending: cap left, reviewer, and Withdraw asks first', async () => {
    renderState('pending')
    expect(await screen.findByText('Waiting for approval')).toBeTruthy()
    expect(screen.getByText('2 kg left')).toBeTruthy()
    expect(screen.getByText('With Liza Ramos')).toBeTruthy()
    expect(screen.getAllByText('In review')).toHaveLength(2)
    expect(screen.queryByText('Move to another association')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw request' }))
    const dialog = await screen.findByRole('dialog', { name: 'Withdraw your request?' })
    expect(withdrawRequest).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Withdraw request' }))
    await vi.waitFor(() => expect(withdrawRequest).toHaveBeenCalledTimes(1))
  })

  it('rejected: the reason, Replace this, and the timeline ends with Send it again', async () => {
    renderState('rejected')
    expect(await screen.findByText('Not approved', { selector: 'span' })).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('The proof of land ownership is blurry.')
    expect(screen.getAllByText('Replace this')).toHaveLength(2)
    expect(screen.getAllByText('Send it again').length).toBeGreaterThan(0)
  })

  it('none: the cap note and the inline join form, Send off until everything is picked', async () => {
    renderState('none')
    expect(await screen.findByText('You’re not in an association yet')).toBeTruthy()
    expect(screen.getByText(/3 of 5 kg used/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Send request' }).disabled).toBe(true)
  })
})
