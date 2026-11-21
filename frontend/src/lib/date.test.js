import { describe, expect, it } from 'vitest'
import { timeAgo } from './date'

describe('timeAgo', () => {
  const ago = (minutes) => new Date(Date.now() - minutes * 60_000)

  it('reads like the screens', () => {
    expect(timeAgo(ago(0.2))).toBe('Just now')
    expect(timeAgo(ago(120))).toBe('2 hours ago')
    expect(timeAgo(ago(3 * 24 * 60))).toBe('3 days ago')
  })

  it('falls back to the date after a week', () => {
    expect(timeAgo(new Date('2026-01-05T04:00:00Z'))).toBe('Jan 5, 2026')
  })
})
