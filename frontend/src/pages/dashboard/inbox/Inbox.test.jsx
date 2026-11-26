// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { useTypingStore } from '@/stores/typing.store'
import { Inbox } from './Inbox'

const NOW = new Date()
const at = (minutesAgo) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString()
const person = (id, name, initials) => ({ id, name, initials, lastDeliveredAt: at(0), lastReadAt: at(0) })

const CHATS = {
  kal: { id: 'kal', type: 'kaluppa', name: 'Kaluppa', initials: 'K', sub: 'Kaluppa team · replies within a day', canPost: true, leftAt: null, unread: 1, memberCount: 2, members: [person('kaluppa', 'Kaluppa', 'K')], lastMessage: { text: 'Your listing is approved.', at: at(30), mine: false, senderName: 'Ana' } },
  grp: { id: 'grp', type: 'group', name: 'Santa Cruz Coffee Growers', initials: 'SC', sub: '4 members · Liza and 3 farmers', canPost: true, leftAt: null, unread: 2, memberCount: 4, members: [person('liza', 'Liza Ramos', 'LR'), person('nestor', 'Nestor Perez', 'NP'), person('lorna', 'Lorna Ilagan', 'LI')], lastMessage: { text: 'Meeting on Saturday.', at: at(10), mine: false, senderName: 'Liza' } },
  boac: { id: 'boac', type: 'group', name: 'Boac Highland Farmers', initials: 'BH', sub: 'Read-only · you left on Mar 2', canPost: false, leftAt: '2026-03-02T02:00:00Z', unread: 0, memberCount: 5, members: [], lastMessage: { text: 'Welcome!', at: '2026-03-02T01:00:00Z', mine: false, senderName: 'Mario' } },
}
const msg = (id, minutesAgo, fields) => ({ id, conversationId: 'grp', body: '', attachments: [], replyTo: null, sender: { id: 'liza', name: 'Liza Ramos', initials: 'LR', team: null }, author: 'Liza Ramos', mine: false, createdAt: at(minutesAgo), editedAt: null, deleted: false, ...fields })
const MESSAGES = {
  grp: [
    msg('g5', 10, { body: 'Meeting on Saturday.' }),
    msg('g4', 12, { deleted: true, body: null, sender: { id: 'lorna', name: 'Lorna Ilagan', initials: 'LI', team: null }, author: 'Lorna Ilagan' }),
    msg('g3', 13, { body: 'Space the branches for airflow.', mine: true, editedAt: at(12), sender: { id: 'me', name: 'Rodel Mendoza', initials: 'RM', team: null }, author: 'Rodel Mendoza' }),
    msg('g2', 14, { body: 'Leaf rust again. Any tips?', sender: { id: 'nestor', name: 'Nestor Perez', initials: 'NP', team: null }, author: 'Nestor Perez' }),
  ],
  boac: [msg('b1', 60 * 24 * 300, { conversationId: 'boac', body: 'Welcome!', author: 'Mario Cruz', sender: { id: 'mario', name: 'Mario Cruz', initials: 'MC', team: null } })],
}

const service = vi.hoisted(() => ({
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  listMessages: vi.fn(),
  sendMessage: vi.fn(async (body) => ({ id: 'new', ...body })),
  editMessage: vi.fn(async (body) => body),
  deleteMessage: vi.fn(async () => ({})),
  markRead: vi.fn(async () => ({})),
  listPeople: vi.fn(async () => []),
  openDirect: vi.fn(),
}))
vi.mock('@/services/inbox.service', () => service)
vi.mock('@/lib/socket', () => ({ emitSocket: vi.fn(), connectSocket: () => () => {} }))

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} }
  Element.prototype.scrollTo = () => {}
  service.listConversations.mockImplementation(async ({ filter } = {}) => Object.values(CHATS).filter((c) => filter !== 'groups' || c.type === 'group'))
  service.getConversation.mockImplementation(async (id) => ({ ...CHATS[id], receipt: id === 'grp' ? { messageId: 'g3', state: 'seen', label: 'Seen by 2', seenBy: [CHATS.grp.members[1], CHATS.grp.members[2]] } : null }))
  service.listMessages.mockImplementation(async (id) => ({ items: MESSAGES[id] ?? [], meta: { hasMore: false, nextCursor: null } }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  useTypingStore.setState({ typing: {} })
})

function renderInbox(url = '/dashboard/inbox/grp') {
  useAuthStore.setState({ status: 'ready', session: { user: { id: 'me', firstName: 'Rodel', lastName: 'Mendoza', emailVerifiedAt: '2026-01-01' }, roles: ['farmer'], permissions: ['dashboard.view', 'inbox.use'] } })
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/dashboard/inbox" element={<Inbox />} />
          <Route path="/dashboard/inbox/:conversationId" element={<Inbox />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const chats = () => screen.getByRole('list', { name: 'Chats' })
const thread = () => screen.getByRole('log', { name: /Messages/ })

describe('Inbox — chat list', () => {
  it('lists chats with previews and unread counts; the open chat is current', async () => {
    renderInbox()
    const list = await screen.findByRole('list', { name: 'Chats' })
    const group = await within(list).findByRole('button', { name: /Santa Cruz Coffee Growers/ })
    expect(group.getAttribute('aria-current')).toBe('true')
    expect(within(group).getByText('Liza: Meeting on Saturday.')).toBeTruthy()
    expect(within(group).getByText('2')).toBeTruthy()
    expect(within(list).getByRole('button', { name: /Kaluppa/ }).textContent).toContain('Ana: Your listing is approved.')
  })

  it('filters with the All / Unread / Groups chips', async () => {
    renderInbox()
    await within(await screen.findByRole('list', { name: 'Chats' })).findByText('Kaluppa')
    fireEvent.click(screen.getByRole('button', { name: 'Groups' }))
    await waitFor(() => expect(service.listConversations).toHaveBeenLastCalledWith(expect.objectContaining({ filter: 'groups' })))
    expect(screen.getByRole('button', { name: 'Groups' }).getAttribute('aria-pressed')).toBe('true')
    await waitFor(() => expect(within(chats()).queryByText('Kaluppa')).toBeNull())
  })
})

describe('Inbox — thread', () => {
  it('shows messages oldest first with authors, the deleted bubble, Edited and "Seen by 2"', async () => {
    renderInbox()
    const log = await screen.findByRole('log', { name: /Messages/ })
    await within(log).findByText('Meeting on Saturday.')
    const texts = within(log).getAllByText(/Leaf rust|Space the branches|Meeting on Saturday/).map((n) => n.textContent)
    expect(texts).toEqual(['Leaf rust again. Any tips?', 'Space the branches for airflow.', 'Meeting on Saturday.'])
    expect(within(log).getByText('Nestor Perez')).toBeTruthy()
    expect(within(log).getByText('This message was deleted')).toBeTruthy()
    expect(within(log).getByText(/· Edited/)).toBeTruthy()
    expect(within(log).getByText('Seen by 2')).toBeTruthy()
    await waitFor(() => expect(service.markRead).toHaveBeenCalledWith('grp', expect.anything()))
  })

  it('Enter sends, Shift+Enter keeps writing, and Reply quotes the message', async () => {
    renderInbox()
    await within(await screen.findByRole('log', { name: /Messages/ })).findByText('Meeting on Saturday.')
    const box = screen.getByLabelText('Message')
    fireEvent.change(box, { target: { value: 'Line one' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(service.sendMessage).not.toHaveBeenCalled()
    const leaf = within(thread()).getByText('Leaf rust again. Any tips?').closest('[data-message]')
    fireEvent.click(within(leaf).getByRole('button', { name: 'Reply' }))
    expect(screen.getByText('Replying to Nestor Perez')).toBeTruthy()
    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() => expect(service.sendMessage).toHaveBeenCalledWith({ conversationId: 'grp', body: 'Line one', attachments: [], replyTo: 'g2' }, expect.anything()))
    await waitFor(() => expect(screen.queryByText('Replying to Nestor Perez')).toBeNull())
  })

  it('edits your own message from its menu', async () => {
    renderInbox()
    const mine = (await within(await screen.findByRole('log', { name: /Messages/ })).findByText('Space the branches for airflow.')).closest('[data-message]')
    fireEvent.click(within(mine).getByRole('button', { name: 'More actions' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit', 'Delete for everyone', 'Delete for me'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }))
    const box = screen.getByPlaceholderText('Edit your message')
    expect(box.value).toBe('Space the branches for airflow.')
    expect(screen.getByText('Editing message')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'Space the branches for better airflow.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save edit' }))
    await waitFor(() => expect(service.editMessage).toHaveBeenCalledWith({ id: 'g3', body: 'Space the branches for better airflow.' }, expect.anything()))
  })

  it('shows who is typing until it expires', async () => {
    renderInbox()
    await within(await screen.findByRole('log', { name: /Messages/ })).findByText('Meeting on Saturday.')
    act(() => useTypingStore.getState().setTyping({ conversationId: 'grp', user: { id: 'nestor', name: 'Nestor' }, expiresInMs: 5000 }))
    expect(await screen.findByText('Nestor is typing…')).toBeTruthy()
    act(() => useTypingStore.getState().setTyping({ conversationId: 'grp', user: { id: 'me', name: 'Rodel' }, expiresInMs: 5000 }))
    expect(screen.queryByText('Rodel is typing…')).toBeNull()
  })

  it('a read-only chat keeps its history and replaces the composer with a note', async () => {
    renderInbox('/dashboard/inbox/boac')
    await within(await screen.findByRole('log', { name: /Messages/ })).findByText('Welcome!')
    expect(screen.getByRole('note').textContent).toBe('You left Boac Highland Farmers on Mar 2. This chat is read-only; its history stays here.')
    expect(screen.queryByLabelText('Message')).toBeNull()
  })
})
