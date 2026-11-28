import { describe, expect, it } from 'vitest'
import { fieldLabel, fieldValue, historyPhrase } from './historyText'

describe('History text', () => {
  it('names a one-field edit, else the action', () => {
    expect(historyPhrase({ area: 'trees', action: 'update', changes: [{ field: 'stage' }] })).toBe('changed the stage')
    expect(historyPhrase({ area: 'trees', action: 'update', changes: [{ field: 'stage' }, { field: 'count' }] })).toBe('edited the tree group')
    expect(historyPhrase({ area: 'orders', action: 'out_for_delivery', changes: [] })).toBe('sent it out for delivery')
    expect(historyPhrase({ area: 'beans', action: 'expire', changes: [] })).toBe('expired the listing after 7 days')
  })

  it('formats values', () => {
    expect(fieldLabel('priceCentavos')).toBe('price')
    expect(fieldValue('priceCentavos', 45000)).toMatch(/450/)
    expect(fieldValue('stage', 'young_bearing')).toBe('young bearing')
    expect(fieldValue('note', null)).toBe('—')
    expect(fieldValue('photos', ['a/b', 'c/d'])).toBe('a/b, c/d')
  })
})
