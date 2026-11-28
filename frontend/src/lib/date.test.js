import { describe, expect, it } from 'vitest'
import { greeting, timeAgo, todayInManila } from './date'

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

describe('greeting', () => {
  it('follows the hour in Manila (UTC+8)', () => {
    expect(greeting(new Date('2026-11-23T00:30:00Z'))).toBe('Good morning') // 8:30 AM
    expect(greeting(new Date('2026-11-23T05:00:00Z'))).toBe('Good afternoon') // 1 PM
    expect(greeting(new Date('2026-11-23T11:00:00Z'))).toBe('Good evening') // 7 PM
    expect(greeting(new Date('2026-11-22T19:00:00Z'))).toBe('Good morning') // 3 AM next day
  })

  it('names the Manila day', () => {
    expect(todayInManila(new Date('2026-11-22T17:00:00Z'))).toBe('Monday, Nov 23')
  })
})
