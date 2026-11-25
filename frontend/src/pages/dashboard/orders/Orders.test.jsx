// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { Orders } from './Orders'

const ORDER = {
  _id: 'o2', orderNumber: 'KK-20261122-0019', status: 'pending', createdAt: '2026-11-22T08:40:00Z', updatedAt: '2026-11-22T08:40:00Z',
  items: [{ product: 'p6', name: 'Complete fertilizer 14-14-14', unit: 'pack', quantity: 2, priceCentavos: 132_000, lineTotalCentavos: 264_000, image: null }],
  subtotalCentavos: 264_000, deliveryFeeCentavos: 5_000, totalCentavos: 269_000,
  fulfillment: { method: 'delivery', distanceKm: 2.6, address: { label: 'Farm', recipientName: 'Rodel Mendoza', phone: '09172221043', street: 'Sitio Ilaya', barangay: 'Pantayin', municipality: 'Santa Cruz', postalCode: '4902' } },
  payment: { method: 'cash' }, refund: { status: 'not_applicable' },
  statusHistory: [{ status: 'pending', at: '2026-11-22T08:40:00Z', byRole: 'farmer' }],
  eta: { from: '2026-11-25T00:00:00Z', to: '2026-11-27T00:00:00Z' },
}

const cancelOrder = vi.hoisted(() => vi.fn(async () => ({ ...ORDER, status: 'cancelled' })))
vi.mock('@/services/order.service', () => ({
  listOrderTable: vi.fn(async () => ({ items: [ORDER], meta: { page: 1, limit: 10, total: 1 } })),
  getOrder: vi.fn(async () => ORDER),
  cancelOrder,
}))

afterEach(cleanup)

function renderFarmer(url = '/dashboard/orders') {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Rodel', lastName: 'Mendoza', emailVerifiedAt: '2026-01-01' }, roles: ['farmer'], permissions: ['dashboard.view', 'orders.view_own', 'orders.cancel_own'] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Orders />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Orders — farmer', () => {
  it('lists the farmer’s orders with items, delivery, payment and status', async () => {
    renderFarmer()
    expect(await screen.findByRole('heading', { name: 'My orders' })).toBeTruthy()
    const table = await screen.findByRole('region', { name: 'Orders' })
    expect(within(table).getByText('Complete fertilizer 14-14-14 × 2')).toBeTruthy()
    expect(within(table).getByText('Delivery · Farm, Santa Cruz')).toBeTruthy()
    expect(within(table).getByText('Cash on delivery')).toBeTruthy()
    expect(within(table).getByText('To confirm')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to store' }).getAttribute('href')).toBe('/products')
  })

  it('opens the view drawer from ?open= and cancels with a picked reason', async () => {
    renderFarmer('/dashboard/orders?open=o2')
    const drawer = await screen.findByRole('dialog', { name: '1 item · ₱2,690' })
    expect(within(drawer).getByText('Waiting for Kaluppa to confirm')).toBeTruthy()
    expect(within(drawer).getByText('Deliver to Farm')).toBeTruthy()
    expect(within(drawer).getByRole('link', { name: 'Open full page' }).getAttribute('href')).toBe('/orders/o2')
    fireEvent.click(within(drawer).getByRole('button', { name: 'Cancel order' }))
    const modal = await screen.findByRole('dialog', { name: 'Cancel this order?' })
    fireEvent.click(within(modal).getByRole('button', { name: /Reason/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Ordered by mistake' }))
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancel order' }))
    await vi.waitFor(() => expect(cancelOrder).toHaveBeenCalled())
    expect(cancelOrder.mock.calls[0][0]).toEqual({ id: 'o2', reasonCode: 'ordered_by_mistake', reason: undefined })
  })
})
