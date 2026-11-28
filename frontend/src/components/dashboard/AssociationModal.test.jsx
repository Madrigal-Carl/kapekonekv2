// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssociationModal } from './AssociationModal'

vi.mock('@/services/association.service', () => ({
  listAssociationOptions: vi.fn(async () => [
    { id: 'a1', name: 'Santa Cruz Coffee Growers', municipality: 'Santa Cruz', location: { lat: 13.47, lng: 122.03 }, groupManager: { name: 'Liza Ramos' } },
    { id: 'a2', name: 'Gasan Coffee Circle', municipality: 'Gasan', location: { lat: 13.32, lng: 121.85 }, groupManager: null },
  ]),
}))
vi.mock('@/components/map/MapPicker', () => ({
  MapPicker: ({ pins, onPin, selectedId, focus }) => (
    <div data-focus={focus.municipality ?? ''}>
      {pins.map((p) => <button key={p.id} type="button" aria-pressed={p.id === selectedId} aria-label={`pin ${p.label}`} onClick={() => onPin(p.id)} />)}
    </div>
  ),
}))
vi.mock('@/services/upload.service', () => ({
  uploadImage: vi.fn(async (file) => ({ url: `https://res.cloudinary.com/x/${file.name}`, publicId: `kapekonek/farmer-documents/u/${file.name}` })),
}))
const requestToJoin = vi.fn(async () => ({ status: 'pending', association: { id: 'a1', name: 'Santa Cruz Coffee Growers' } }))
vi.mock('@/services/farmer.service', () => ({ requestToJoin: (body) => requestToJoin(body) }))

afterEach(cleanup)
beforeEach(() => requestToJoin.mockClear())

const open = (props = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AssociationModal open onClose={() => {}} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )

const pickFile = (label, name, type) =>
  fireEvent.change(screen.getByLabelText(label), { target: { files: [new File(['x'], name, { type })] } })

describe('AssociationModal', () => {
  it('picking a pin on the map selects that association and shades its town (Change 08)', async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'pin Gasan Coffee Circle' }, { timeout: 5000 })) // the map loads lazily
    expect(await screen.findByText(/No Group Manager yet/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Association/ }).textContent).toContain('Gasan Coffee Circle')
    expect(screen.getByRole('button', { name: 'pin Gasan Coffee Circle' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'pin Gasan Coffee Circle' }).parentElement.dataset.focus).toBe('Gasan')
  })

  it('keeps Send disabled until an association and both documents are chosen', async () => {
    open()
    const send = screen.getByRole('button', { name: 'Send request' })
    expect(send.disabled).toBe(true)

    fireEvent.click(await screen.findByRole('button', { name: /Association/ }))
    fireEvent.click(await screen.findByRole('option', { name: /Santa Cruz Coffee Growers/ }))
    expect(screen.getByText(/Group Manager: Liza Ramos/)).toBeTruthy()
    expect(send.disabled).toBe(true)

    pickFile('Upload valid ID', 'philsys-id.jpg', 'image/jpeg')
    await screen.findByText('philsys-id.jpg')
    expect(send.disabled).toBe(true)

    pickFile('Upload proof of land ownership', 'tax-declaration.pdf', 'application/pdf')
    await screen.findByText('tax-declaration.pdf')
    await waitFor(() => expect(send.disabled).toBe(false))

    fireEvent.click(send)
    await screen.findByRole('heading', { name: 'Request sent' })
    expect(requestToJoin).toHaveBeenCalledWith({
      associationId: 'a1',
      validId: { url: 'https://res.cloudinary.com/x/philsys-id.jpg', publicId: 'kapekonek/farmer-documents/u/philsys-id.jpg' },
      landProof: { url: 'https://res.cloudinary.com/x/tax-declaration.pdf', publicId: 'kapekonek/farmer-documents/u/tax-declaration.pdf' },
    })
  })

  it('shows the Group Manager’s reason when the last request was rejected', () => {
    open({ rejection: { reason: 'The proof of land ownership is blurry.', by: 'Liza Ramos' } })
    expect(screen.getByRole('alert').textContent).toContain('“The proof of land ownership is blurry.” — Liza Ramos')
  })
})
