import { describe, expect, it } from 'vitest'
import { periodNote, periodTitle } from './periods'

const month = { key: 'month', prevLabel: 'October' }

describe('periodNote', () => {
  it('counts for today and this week', () => {
    expect(periodNote({ key: 'today' }, { count: 0 }, 'harvest', 'recorded')).toEqual({ text: 'Nothing recorded yet today', tone: 'muted' })
    expect(periodNote({ key: 'today' }, { count: 3 }, 'harvest', 'recorded').text).toBe('3 harvests recorded today')
    expect(periodNote({ key: 'week' }, { count: 1 }, 'order', 'sold').text).toBe('1 order sold')
  })

  it('compares with the previous month or year', () => {
    expect(periodNote(month, { count: 4, pct: 12 }, 'harvest', 'recorded')).toEqual({ text: '▲ 12% vs October', tone: 'good' })
    expect(periodNote({ key: 'year', prevLabel: 'last year' }, { count: 4, pct: -8 }, 'order', 'sold')).toEqual({ text: '▼ 8% vs last year', tone: 'muted' })
    expect(periodNote(month, { count: 4, pct: null }, 'order', 'sold').text).toBe('Nothing to compare with October')
  })

  it('picks the title for the period', () => {
    expect(periodTitle(month, ['a', 'b', 'c', 'd'])).toBe('c')
  })
})
