// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useMentions } from '@/hooks/useMentions'
import { useAuthStore } from '@/stores/auth.store'
import { MentionList, MentionNote, MentionText } from './Mentions'

const PEOPLE = [
  { id: 'kaluppa', name: 'Kaluppa', initials: 'KP', sub: 'Kaluppa team' },
  { id: 'u1', name: 'Ben Farmer', initials: 'BF', sub: 'Farmer · Santa Cruz Coffee Growers' },
  { id: 'u2', name: 'Bea Cruz', initials: 'BC', sub: 'Farmer · Santa Cruz Coffee Growers' },
]
const listPeople = vi.hoisted(() => vi.fn())
vi.mock('@/services/inbox.service', () => ({ listPeople }))
listPeople.mockImplementation(async (q) => PEOPLE.filter((p) => p.name.toLowerCase().includes((q ?? '').toLowerCase())))

afterEach(cleanup)

function Box() {
  const [text, setText] = useState('')
  const ref = useRef(null)
  const mention = useMentions(text, setText, ref)
  return (
    <>
      <textarea ref={ref} aria-label="Post text" value={text} {...mention.inputProps('m')} onKeyDown={mention.onKeyDown} />
      <MentionList id="m" mention={mention} />
      <MentionNote mention={mention} />
      <output aria-label="Mentioned ids">{mention.ids(text).join(',')}</output>
    </>
  )
}

const renderBox = () => {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Ana', lastName: 'Farmer' }, roles: ['farmer'], permissions: ['inbox.use'] } })
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Box /></QueryClientProvider>)
  return screen.getByLabelText('Post text')
}

describe('Hub @mentions (Change 08)', () => {
  it('typing @ lists the people you may mention; ↓ and Enter insert the full name', async () => {
    const box = renderBox()
    fireEvent.change(box, { target: { value: 'Thanks @b' } })
    expect(await screen.findByRole('option', { name: /Ben Farmer/ })).toBeTruthy()
    expect(screen.getByText('You can mention Kaluppa, your Group Manager and farmers in your association.')).toBeTruthy()
    expect(screen.getByRole('option', { name: /Ben Farmer/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(box, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Bea Cruz/ }).getAttribute('aria-selected')).toBe('true')
    expect(box.getAttribute('aria-activedescendant')).toBe('m-1')
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(box.value).toBe('Thanks @Bea Cruz ')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByText(/they’ll get a notification/).textContent).toBe('Mentioning @Bea Cruz — they’ll get a notification.')
    expect(screen.getByLabelText('Mentioned ids').textContent).toBe('u2')
    // Deleting the name drops the mention.
    fireEvent.change(box, { target: { value: 'Thanks ' } })
    expect(screen.getByLabelText('Mentioned ids').textContent).toBe('')
  })

  it('Esc closes the list, and a query with no match says so', async () => {
    const box = renderBox()
    fireEvent.change(box, { target: { value: '@zz' } })
    expect(await screen.findByText('No one you can mention matches “zz”.')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('renders mentions as highlights with the role and association', () => {
    render(<p><MentionText text="Salamat @Ben Farmer and @Kaluppa!" mentions={[{ _id: 'u1', name: 'Ben Farmer', sub: 'Farmer · Santa Cruz Coffee Growers' }, { _id: 'k', name: 'Kaluppa', sub: 'Kaluppa' }]} /></p>)
    const ben = screen.getByTitle('Farmer · Santa Cruz Coffee Growers')
    expect(ben.textContent).toBe('@Ben Farmer (Farmer · Santa Cruz Coffee Growers)')
    expect(screen.getByTitle('Kaluppa').textContent).toContain('@Kaluppa')
  })
})
