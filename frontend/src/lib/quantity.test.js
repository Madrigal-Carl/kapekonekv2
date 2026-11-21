import { describe, expect, it } from 'vitest'
import { clampQuantity, stepFor } from './quantity'

describe('stepFor', () => {
  it('uses half-kilo steps for kg and whole steps otherwise', () => {
    expect(stepFor('kg')).toBe(0.5)
    expect(stepFor('pack')).toBe(1)
    expect(stepFor('piece')).toBe(1)
  })
})

describe('clampQuantity', () => {
  it('keeps quantities between the minimum and the stock', () => {
    expect(clampQuantity(0, 'pack', 10)).toBe(1)
    expect(clampQuantity(12, 'pack', 10)).toBe(10)
    expect(clampQuantity(0, 'kg', 10)).toBe(0.5)
  })

  it('snaps to the unit step without going over stock', () => {
    expect(clampQuantity(1.3, 'kg', 10)).toBe(1.5)
    expect(clampQuantity(2.6, 'pack', 10)).toBe(3)
    expect(clampQuantity(3, 'kg', 2.7)).toBe(2.5)
  })
})
