// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ReviewList } from './ReviewList'

const author = { _id: 'u1', name: 'Marites A.', initials: 'MA', roleLabel: 'Buyer', avatarUrl: null }
vi.mock('@/services/catalog.service', () => ({
  listReviews: vi.fn(async () => ({
    items: [
      { _id: 'r1', rating: 5, comment: 'Strong and smooth, exactly right.', createdAt: '2026-11-14T02:00:00Z', editedAt: null, author, reply: { body: 'Salamat po, Marites!', at: '2026-11-15T02:00:00Z', editedAt: null } },
      { _id: 'r2', rating: 4, comment: 'Bold flavor, would buy again.', createdAt: '2026-11-02T02:00:00Z', editedAt: null, author, reply: null },
    ],
    meta: { hasMore: false, nextCursor: null },
  })),
}))
afterEach(cleanup)

it('shows Kaluppa’s reply under the review it answers', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ReviewList productId="p1" total={2} />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('Salamat po, Marites!')).toBeTruthy()
  expect(screen.getAllByText('Reply from Kaluppa')).toHaveLength(1)
})
