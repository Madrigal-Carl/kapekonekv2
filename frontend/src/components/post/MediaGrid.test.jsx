// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { MediaGrid } from './MediaGrid'
import { PostComposer } from './PostComposer'

afterEach(cleanup)

const items = (n) => Array.from({ length: n }, (_, i) => ({ type: i === 1 ? 'video' : 'image', url: `https://img/${i}.jpg`, posterUrl: 'https://img/p.jpg', alt: `Item ${i + 1}` }))
const tiles = () => within(screen.getByTestId('media-grid')).getAllByRole('button')

describe('MediaGrid (fixed 16:10 frame)', () => {
  it.each([
    [1, 'grid-cols-1', 1],
    [2, 'grid-cols-2', 2],
    [3, 'grid-cols-[2fr_1fr]', 3],
    [7, 'grid-rows-2', 4],
  ])('%i items → %s with %i tiles', (n, layout, shown) => {
    render(<MediaGrid media={items(n)} onOpen={() => {}} />)
    expect(screen.getByTestId('media-grid').className).toContain('aspect-[16/10]')
    expect(screen.getByTestId('media-grid').className).toContain(layout)
    expect(tiles()).toHaveLength(shown)
  })

  it('puts "+N" on the 4th tile and opens the viewer at the tile clicked', () => {
    const onOpen = vi.fn()
    render(<MediaGrid media={items(7)} onOpen={onOpen} />)
    expect(tiles()[3].textContent).toContain('+3')
    expect(tiles()[0].getAttribute('aria-label')).toBe('Open photo 1 of 7')
    fireEvent.click(tiles()[1])
    expect(tiles()[1].getAttribute('aria-label')).toBe('Open video 2 of 7')
    expect(onOpen).toHaveBeenCalledWith(1)
  })

  it('renders nothing without media', () => {
    const { container } = render(<MediaGrid media={[]} onOpen={() => {}} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('PostComposer', () => {
  it('expands on focus and disables the other tags once 3 are picked', () => {
    useAuthStore.setState({ session: { user: { id: 'me', initials: 'RM' }, roles: ['farmer'], permissions: ['posts.create'] }, status: 'ready' })
    render(<QueryClientProvider client={new QueryClient()}><PostComposer /></QueryClientProvider>)
    expect(screen.queryByText(/up to 3/)).toBeNull()
    fireEvent.focus(screen.getByLabelText('Share an update'))
    for (const tag of ['#pruning', '#soil', '#advisory']) fireEvent.click(screen.getByRole('button', { name: tag }))
    expect(screen.getByText(/3\/3/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '#harvesting' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '#soil' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Post' }).disabled).toBe(true)
  })
})
