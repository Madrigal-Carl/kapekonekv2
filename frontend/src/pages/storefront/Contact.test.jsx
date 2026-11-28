// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Contact } from './Contact'

const sendContactMessage = vi.hoisted(() => vi.fn(async () => ({ sent: true })))
vi.mock('@/services/contact.service', () => ({ sendContactMessage }))
vi.mock('@/components/map/MapPicker', () => ({ MapPicker: ({ ariaLabel }) => <div aria-label={ariaLabel} /> }))
vi.mock('@/services/setting.service', () => ({
  getDeliveryInfo: vi.fn(async () => ({
    pickup: { name: 'Kaluppa', address: 'Pantayin, Santa Cruz, Marinduque', hours: '', phone: '0917 800 1122', location: { lat: 13.467, lng: 122.044 } },
    contact: { email: 'branch@example.com', hours: [{ days: 'Mon – Sat', time: '8:00 AM – 5:00 PM' }, { days: 'Sunday', time: 'Closed' }] },
  })),
}))

afterEach(cleanup)

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Contact />
      </MemoryRouter>
    </QueryClientProvider>,
  )

describe('Contact us (Change 08)', () => {
  it('shows the branch from Settings, marks missing fields, then sends', async () => {
    renderPage()
    expect(await screen.findByRole('link', { name: '0917 800 1122' })).toHaveProperty('href', 'tel:+639178001122')
    expect(screen.getByRole('link', { name: 'branch@example.com' }).getAttribute('href')).toBe('mailto:branch@example.com')
    expect(screen.getByText('Sunday')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Please fix the fields marked below.')).toBeTruthy()
    expect(screen.getByText('Enter your name.')).toBeTruthy()
    expect(screen.getByText('Enter your email so we can reply.')).toBeTruthy()
    expect(screen.getByText('Write at least 10 characters.')).toBeTruthy()

    fireEvent.input(screen.getByLabelText('Full name'), { target: { value: 'Carla Reyes' } })
    fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'carla@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /Topic/ }))
    fireEvent.click(await screen.findByRole('option', { name: /Payment/ }))
    fireEvent.input(screen.getByLabelText('Message'), { target: { value: 'How do I pay with GCash?' } })
    expect(screen.getByText('24 / 1,000')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))

    expect(await screen.findByRole('heading', { name: 'Message sent' })).toBeTruthy()
    expect(sendContactMessage.mock.calls[0][0]).toMatchObject({ name: 'Carla Reyes', email: 'carla@example.com', topic: 'Payment', phone: null, orderNumber: null })
    expect(screen.getByRole('status').textContent).toContain('Thanks, Carla. We sent a copy to carla@example.com')
    fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))
    expect(screen.getByLabelText('Full name').value).toBe('Carla Reyes')
    expect(screen.getByLabelText('Message').value).toBe('')
  })
})
