import { describe, expect, it } from 'vitest'
import { fillPayments, orList, paymentPhrase } from './payments'

describe('payment copy from the shown providers', () => {
  it('lists them with "or"', () => {
    expect(orList(['GCash'])).toBe('GCash')
    expect(paymentPhrase(['GCash'])).toBe('GCash or cash on delivery')
    expect(paymentPhrase(['GCash', 'Maya'])).toBe('GCash, Maya or cash on delivery')
    expect(paymentPhrase([], 'cash')).toBe('cash')
  })

  it('fills the {payments} token', () => {
    expect(fillPayments('Pay by {payments}.', ['GCash'])).toBe('Pay by GCash or cash on delivery.')
  })
})
