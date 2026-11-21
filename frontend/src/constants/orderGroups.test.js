import { describe, expect, it } from 'vitest'
import { CANCEL_REASONS, groupCount, ORDER_GROUPS, ORDER_STATUS, paymentLabel, refundLabel, timelineSteps } from './orderStatus'

describe('order groups', () => {
  it('cover every status exactly once outside "All orders"', () => {
    const grouped = ORDER_GROUPS.filter((g) => g.statuses).flatMap((g) => g.statuses)
    expect(grouped.sort()).toEqual(Object.keys(ORDER_STATUS).sort())
    expect(ORDER_GROUPS.map((g) => g.key)).toEqual(['all', 'to_confirm', 'preparing', 'on_the_way', 'completed', 'closed'])
  })

  it('maps each group to its statuses', () => {
    const byKey = Object.fromEntries(ORDER_GROUPS.map((g) => [g.key, g.statuses]))
    expect(byKey).toMatchObject({
      all: null,
      to_confirm: ['pending'],
      preparing: ['reserved', 'processing'],
      on_the_way: ['out_for_delivery', 'ready_for_pickup'],
      completed: ['sold'],
      closed: ['cancelled', 'rejected', 'expired'],
    })
  })

  it('counts a group from per-status counts', () => {
    const counts = { pending: 2, reserved: 1, processing: 1, sold: 6, expired: 1 }
    expect(groupCount(null, counts)).toBe(11)
    expect(groupCount(['reserved', 'processing'], counts)).toBe(2)
    expect(groupCount(['cancelled'], counts)).toBe(0)
  })

  it('labels payment and refunds', () => {
    expect(paymentLabel({ payment: { method: 'cash' }, fulfillment: { method: 'pickup' } })).toBe('Cash on pickup')
    expect(paymentLabel({ payment: { method: 'e_wallet', provider: 'Maya' }, fulfillment: { method: 'delivery' } })).toBe('Maya')
    expect(refundLabel({ status: 'refunded', referenceNumber: '7023118842' })).toBe('Refunded · Ref 7023118842')
    expect(refundLabel({ status: 'not_applicable' })).toBeNull()
    expect(CANCEL_REASONS.at(-1).code).toBe('other')
  })
})

describe('timelineSteps', () => {
  const at = '2026-11-19T02:42:00.000Z'
  const base = { payment: { method: 'cash' }, fulfillment: { method: 'delivery' } }

  it('shows history as done, the latest as current, then the rest of the path', () => {
    const order = { ...base, status: 'out_for_delivery', statusHistory: ['pending', 'reserved', 'processing', 'out_for_delivery'].map((status) => ({ status, at })) }
    order.fulfillment = { method: 'delivery', rider: { name: 'Jun R.', phone: '09175550102' } }
    const steps = timelineSteps(order)
    expect(steps.map((s) => [s.title, s.done, s.current])).toEqual([
      ['Order placed', true, false],
      ['Reserved', true, false],
      ['Processing', true, false],
      ['Out for delivery', true, true],
      ['Sold', false, false],
    ])
    expect(steps[0].meta).toMatch(/by you · Cash on delivery$/)
    expect(steps[3].meta).toMatch(/Rider: Jun R\. · 0917 555 0102$/)
    expect(steps[4].meta).toBe('When it’s delivered and paid')
  })

  it('uses the pickup path and stops at closed statuses', () => {
    const pending = timelineSteps({ ...base, fulfillment: { method: 'pickup' }, status: 'pending', statusHistory: [{ status: 'pending', at }] })
    expect(pending.map((s) => s.title)).toEqual(['Order placed', 'Reserved', 'Processing', 'Ready for pickup', 'Sold'])
    const cancelled = timelineSteps({ ...base, status: 'cancelled', statusHistory: [{ status: 'pending', at }, { status: 'cancelled', at, reason: 'Ordered by mistake' }] })
    expect(cancelled.map((s) => [s.title, s.current])).toEqual([['Order placed', false], ['Cancelled', false]])
    expect(cancelled[1].meta).toMatch(/by you · Ordered by mistake$/)
  })
})
