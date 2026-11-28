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
const byId = vi.hoisted(() => ({}))
const changeOrderStatus = vi.hoisted(() => vi.fn(async ({ id, status }) => ({ ...byId[id], status })))
const markOrderRefunded = vi.hoisted(() => vi.fn(async ({ id }) => ({ ...byId[id], refund: { status: 'refunded' } })))
vi.mock('@/services/order.service', () => ({
  listOrderTable: vi.fn(async () => ({ items: [ORDER], meta: { page: 1, limit: 10, total: 1 } })),
  listAdminOrders: vi.fn(async () => ({ items: Object.values(byId), meta: { page: 1, limit: 10, total: Object.keys(byId).length } })),
  exportAdminOrders: vi.fn(),
  getOrder: vi.fn(async (id) => byId[id] ?? ORDER),
  cancelOrder,
  changeOrderStatus,
  markOrderRefunded,
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

const CUSTOMER = { id: 'u1', name: 'Marites Abad', role: 'buyer', phone: '09173004410' }
const variant = (id, patch) => ({ ...ORDER, _id: id, orderNumber: `KK-20261123-000${id.slice(1)}`, customer: CUSTOMER, ...patch })
Object.assign(byId, {
  o1: variant('o1', { payment: { method: 'e_wallet', provider: 'GCash', receipt: { url: 'https://res.cloudinary.com/t/image/upload/r.jpg' }, submittedAt: '2026-11-23T00:02:00Z' } }),
  o3: variant('o3', { status: 'processing' }),
  o4: variant('o4', { status: 'out_for_delivery', fulfillment: { ...ORDER.fulfillment, rider: { name: 'Jomar Villareal', phone: '09181112233' } } }),
  o5: variant('o5', { status: 'cancelled', payment: { method: 'e_wallet', provider: 'Maya', receipt: { url: 'https://res.cloudinary.com/t/image/upload/r.jpg' } }, refund: { status: 'pending' } }),
})

function renderKaluppa(url) {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'k', firstName: 'Ana', lastName: 'Villanueva', emailVerifiedAt: '2026-01-01' }, roles: ['kaluppa'], permissions: ['dashboard.view'] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Orders />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const footerButton = async (name) => within(await screen.findByRole('dialog')).findByRole('button', { name })

describe('Orders — Kaluppa', () => {
  afterEach(() => vi.clearAllMocks())

  it('lists every order with the customer, To confirm first, and the customer, delivery and payment filters', async () => {
    renderKaluppa('/dashboard/orders')
    expect(await screen.findByRole('heading', { name: 'Orders' })).toBeTruthy()
    const table = await screen.findByRole('region', { name: 'Orders' })
    expect((await within(table).findAllByText('Marites Abad')).length).toBeGreaterThan(0)
    const filters = within(table).getByRole('group', { name: 'Filters' })
    expect(within(filters).getByRole('button', { name: /Status/ }).textContent).toContain('To confirm')
    for (const name of [/Customer/, /Delivery/, /Payment/]) expect(within(filters).getByRole('button', { name })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(screen.getByRole('dialog', { name: 'Export orders' })).toBeTruthy()
  })

  it('keeps Confirm off until the receipt is ticked for an e-wallet order', async () => {
    renderKaluppa('/dashboard/orders?open=o1')
    const confirm = await footerButton('Confirm order')
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'The receipt matches the total' }))
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    await vi.waitFor(() => expect(changeOrderStatus.mock.calls[0]?.[0]).toEqual({ id: 'o1', status: 'reserved' }))
  })

  it('rejects with a picked reason', async () => {
    renderKaluppa('/dashboard/orders?open=o1')
    fireEvent.click(await footerButton('Reject'))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Reason for rejecting/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Out of stock' }))
    fireEvent.click(await footerButton('Reject order'))
    await vi.waitFor(() => expect(changeOrderStatus.mock.calls[0]?.[0]).toEqual({ id: 'o1', status: 'rejected', reasonCode: 'out_of_stock' }))
  })

  it('asks for the rider before Out for delivery', async () => {
    renderKaluppa('/dashboard/orders?open=o3')
    const next = await footerButton('Out for delivery')
    expect(next.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Rider name'), { target: { value: 'Jomar Villareal' } })
    fireEvent.change(screen.getByLabelText('Rider phone'), { target: { value: '0918 111 2233' } })
    expect(next.disabled).toBe(false)
    fireEvent.click(next)
    await vi.waitFor(() => expect(changeOrderStatus.mock.calls[0]?.[0]).toEqual({ id: 'o3', status: 'out_for_delivery', rider: { name: 'Jomar Villareal', phone: '09181112233' } }))
  })

  it('marks a cash order sold only after the cash is ticked', async () => {
    renderKaluppa('/dashboard/orders?open=o4')
    const sold = await footerButton('Mark sold')
    expect(sold.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /collected/ }))
    fireEvent.click(sold)
    await vi.waitFor(() => expect(changeOrderStatus.mock.calls[0]?.[0]).toEqual({ id: 'o4', status: 'sold' }))
  })

  it('records the refund reference for a cancelled e-wallet order', async () => {
    renderKaluppa('/dashboard/orders?open=o5')
    const refund = await footerButton('Mark refunded')
    expect(refund.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Refund reference number'), { target: { value: '5011 2290 774' } })
    fireEvent.click(refund)
    await vi.waitFor(() => expect(markOrderRefunded.mock.calls[0]?.[0]).toEqual({ id: 'o5', referenceNumber: '5011 2290 774' }))
  })
})
