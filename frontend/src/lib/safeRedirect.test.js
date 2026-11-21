import { describe, expect, it } from 'vitest'
import { safeRedirect } from './safeRedirect.js'

describe('safeRedirect', () => {
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined, 'orders'])(
    'falls back for %s',
    (value) => expect(safeRedirect(value, '/')).toBe('/'),
  )

  it('keeps internal paths with their query', () => {
    expect(safeRedirect('/orders?x=1', '/')).toBe('/orders?x=1')
    expect(safeRedirect('/products/barako#reviews', '/')).toBe('/products/barako#reviews')
  })
})
