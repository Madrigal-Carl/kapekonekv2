// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth.store'
import { CreatePostModal } from './CreatePostModal'
import { PostCard } from './PostCard'
import { PostViewer } from './PostViewer'

vi.mock('@/services/post.service', () => ({
  getPost: vi.fn(),
  listComments: vi.fn(async () => ({ items: [], meta: { hasMore: false } })),
  recordView: vi.fn(async () => ({})),
  createPost: vi.fn(async () => ({})),
  updatePost: vi.fn(async () => ({})),
  setReaction: vi.fn(),
  addComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  removeComment: vi.fn(),
  listReplies: vi.fn(),
}))

afterEach(cleanup)
beforeEach(() => {
  useAuthStore.setState({ session: { user: { id: 'me', initials: 'RM', firstName: 'Rodel', lastName: 'Mendoza' }, roles: ['farmer'], permissions: ['posts.create'] }, status: 'ready' })
  globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} }
})

const author = { _id: 'a1', name: 'Liza Ramos', initials: 'LR', role: 'group_manager', roleLabel: 'Group Manager' }
const POST = {
  _id: 'p1', author, body: 'Short tip.', tags: ['soil'], media: [], createdAt: '2026-11-20T01:00:00Z', viewCount: 12,
  reactionCounts: { like: 1, love: 0, celebrate: 0 }, myReaction: null, commentCount: 3,
  lastComment: { _id: 'c3', body: 'Salamat po!', createdAt: '2026-11-21T01:00:00Z', author: { _id: 'me', name: 'Rodel Mendoza', initials: 'RM', role: 'farmer', roleLabel: 'Farmer' } },
}
const photos = (n) => Array.from({ length: n }, (_, i) => ({ type: 'image', url: `https://img/${i}.jpg`, alt: '' }))
const wrap = (ui) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)

describe('CreatePostModal (HubCreatePost)', () => {
  it('opens on the tag picker; 3 tags disable the rest; Post waits for text', () => {
    wrap(<CreatePostModal start="tags" onClose={() => {}} onDone={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Create post' })
    expect(within(dialog).getByPlaceholderText('What’s on your mind, Rodel?')).toBeTruthy()
    for (const tag of ['#pruning', '#soil', '#advisory']) fireEvent.click(within(dialog).getByRole('button', { name: tag }))
    expect(within(dialog).getByText(/3\/3/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: '#harvesting' }).disabled).toBe(true)
    expect(within(dialog).getByRole('button', { name: 'Remove tag soil' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Post' }).disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText('Post text'), { target: { value: 'Pruning day' } })
    expect(within(dialog).getByRole('button', { name: 'Post' }).disabled).toBe(false)
  })

  it('opens with the dropzone for Photo / video', () => {
    wrap(<CreatePostModal start="media" onClose={() => {}} onDone={() => {}} />)
    expect(screen.getByRole('button', { name: /Add photos or videos or drag and drop/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add photos or videos' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows the count near 5,000 and, past it, the rule and a disabled Post', () => {
    wrap(<CreatePostModal onClose={() => {}} onDone={() => {}} />)
    const box = screen.getByLabelText('Post text')
    fireEvent.change(box, { target: { value: 'a'.repeat(4200) } })
    expect(screen.getByText('4,200 / 5,000')).toBeTruthy()
    fireEvent.change(box, { target: { value: 'a'.repeat(5001) } })
    expect(screen.getByText('Use 5,000 characters or fewer · 5,001 / 5,000')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Post' }).disabled).toBe(true)
  }, 20_000)

  it('closing with something written asks first; Keep editing keeps it, Discard closes', () => {
    const onClose = vi.fn()
    wrap(<CreatePostModal onClose={onClose} onDone={() => {}} />)
    fireEvent.change(screen.getByLabelText('Post text'), { target: { value: 'Draft' } })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Create post' })).getByRole('button', { name: 'Close' }))
    const ask = screen.getByRole('dialog', { name: 'Discard this post?' })
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep editing' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Post text').value).toBe('Draft')
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Discard this post?' })).getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('an empty modal closes at once; editing says Edit post / Save', () => {
    const onClose = vi.fn()
    wrap(<CreatePostModal onClose={onClose} onDone={() => {}} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    cleanup()
    wrap(<CreatePostModal post={POST} onClose={() => {}} onDone={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Edit post' })
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeTruthy()
    fireEvent.change(within(dialog).getByLabelText('Post text'), { target: { value: 'Changed' } })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'Discard your changes?' })).toBeTruthy()
  })
})

describe('PostCard (feed)', () => {
  it('cuts long captions with See more, shows the last comment, and opens the viewer', () => {
    const onOpen = vi.fn()
    const long = { ...POST, body: `${'word '.repeat(60)}end` }
    wrap(<PostCard post={long} onOpen={onOpen} onEdit={() => {}} onAsk={() => {}} onToast={() => {}} />)
    expect(screen.queryByText(/end$/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'See more' }))
    expect(onOpen).toHaveBeenLastCalledWith(long, undefined)
    expect(screen.getByText('Salamat po!')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'View all 3 comments' }))
    fireEvent.click(screen.getByRole('button', { name: 'Write a comment…' }))
    expect(onOpen).toHaveBeenLastCalledWith(long, { comment: true })
    fireEvent.click(screen.getByRole('button', { name: 'Comment' }))
    expect(onOpen).toHaveBeenLastCalledWith(long, { comment: true })
    expect(screen.queryByLabelText('Write a comment')).toBeNull() // no inline thread
  })
})

describe('PostViewer', () => {
  it('a post with media: counter, previous / next and arrow keys move through it', async () => {
    const { getPost } = await import('@/services/post.service')
    const post = { ...POST, media: photos(3) }
    getPost.mockResolvedValue(post)
    const onIndex = vi.fn()
    wrap(<PostViewer id="p1" initial={post} index={1} onIndex={onIndex} onClose={() => {}} onTag={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Liza Ramos' })
    expect(within(dialog).getByText('2 / 3')).toBeTruthy()
    expect(within(dialog).getByRole('img', { name: 'Photo 2 of 3' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }))
    expect(onIndex).toHaveBeenLastCalledWith(2)
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' })
    expect(onIndex).toHaveBeenLastCalledWith(0)
    expect(within(dialog).getByRole('button', { name: 'Show photo 3' })).toBeTruthy()
    expect(within(dialog).getByLabelText('Write a comment')).toBeTruthy()
    expect(await within(dialog).findByText('No comments yet. Be the first to comment.')).toBeTruthy()
  })

  it('a text-only post is a dialog titled with the author’s first name; a tag filters the feed', async () => {
    const { getPost } = await import('@/services/post.service')
    getPost.mockResolvedValue(POST)
    const onTag = vi.fn()
    wrap(<PostViewer id="p1" initial={POST} index={0} onIndex={() => {}} onClose={() => {}} onTag={onTag} />)
    expect(screen.getByText('Liza’s post')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '#soil' }))
    expect(onTag).toHaveBeenCalledWith('soil')
  })
})
