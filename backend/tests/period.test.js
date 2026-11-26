import { describe, expect, it } from 'vitest';
import { bucketize, compare, periodRange } from '../src/utils/period.js';

// Manila is UTC+8: 2026-11-27T01:00Z is Friday Nov 27, 9:00 AM in Manila.
const NOW = new Date('2026-11-27T01:00:00Z');
const iso = (d) => d.toISOString();

describe('periodRange (Asia/Manila calendar, Monday weeks)', () => {
  it('today runs from Manila midnight to midnight, with 2-hour buckets from 6 AM', () => {
    const r = periodRange('today', NOW);
    expect([iso(r.from), iso(r.to), iso(r.prevFrom)]).toEqual(['2026-11-26T16:00:00.000Z', '2026-11-27T16:00:00.000Z', '2026-11-25T16:00:00.000Z']);
    expect(r.labels).toEqual(['6 AM', '8 AM', '10 AM', '12 PM', '2 PM', '4 PM']);
    expect(r.rangeText).toBe('Nov 27, 2026');
    // 5 AM → first bucket, 1:30 PM → the 12 PM bucket, 8 PM → last bucket
    expect(['2026-11-26T21:00:00Z', '2026-11-27T05:30:00Z', '2026-11-27T12:00:00Z'].map((t) => r.bucketOf(new Date(t)))).toEqual([0, 3, 5]);
  });

  it('a week starts on Monday in Manila, even when UTC is still on Sunday', () => {
    const r = periodRange('week', NOW);
    expect([iso(r.from), iso(r.to), iso(r.prevFrom)]).toEqual(['2026-11-22T16:00:00.000Z', '2026-11-29T16:00:00.000Z', '2026-11-15T16:00:00.000Z']);
    expect(r.rangeText).toBe('Nov 23 – Nov 29, 2026');
    expect(r.labels[0]).toBe('Mon');
    // Sunday 11:30 PM Manila still belongs to the week of Nov 23; 12:30 AM Monday starts the next.
    expect(iso(periodRange('week', new Date('2026-11-29T15:30:00Z')).from)).toBe('2026-11-22T16:00:00.000Z');
    expect(iso(periodRange('week', new Date('2026-11-29T16:30:00Z')).from)).toBe('2026-11-29T16:00:00.000Z');
    expect(r.bucketOf(new Date('2026-11-29T15:59:00Z'))).toBe(6);
  });

  it('a month is the Manila calendar month, bucketed by week, compared with the month before', () => {
    const r = periodRange('month', NOW);
    expect([iso(r.from), iso(r.to), iso(r.prevFrom)]).toEqual(['2026-10-31T16:00:00.000Z', '2026-11-30T16:00:00.000Z', '2026-09-30T16:00:00.000Z']);
    expect(r.rangeText).toBe('Nov 1 – Nov 30, 2026');
    expect(r.prevLabel).toBe('October');
    expect(r.labels).toEqual(['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']);
    expect(periodRange('month', new Date('2026-02-10T00:00:00Z')).labels).toHaveLength(4);
    // 12:05 AM Dec 1 in Manila is already December; January compares with December.
    expect(periodRange('month', new Date('2026-11-30T16:05:00Z')).prevLabel).toBe('November');
    expect(periodRange('month', new Date('2027-01-05T00:00:00Z')).prevLabel).toBe('December');
  });

  it('a year is Jan 1 – Dec 31 in Manila, bucketed by month', () => {
    const r = periodRange('year', NOW);
    expect([iso(r.from), iso(r.to), iso(r.prevFrom)]).toEqual(['2025-12-31T16:00:00.000Z', '2026-12-31T16:00:00.000Z', '2024-12-31T16:00:00.000Z']);
    expect(r.rangeText).toBe('Jan 1 – Dec 31, 2026');
    expect(r.labels).toHaveLength(12);
    expect(r.bucketOf(new Date('2026-01-31T17:00:00Z'))).toBe(1); // Feb 1, 1 AM in Manila
  });

  it('bucketize sums rows into buckets', () => {
    const r = periodRange('week', NOW);
    expect(bucketize(r, [{ at: new Date('2026-11-23T02:00:00Z'), value: 3 }, { at: new Date('2026-11-23T09:00:00Z'), value: 2 }, { at: new Date('2026-11-27T01:00:00Z'), value: 1 }])).toEqual([5, 0, 0, 0, 1, 0, 0]);
  });
});

describe('compare', () => {
  it('rounds the change against the previous period, and has nothing to compare with zero', () => {
    expect(compare(112, 100)).toEqual({ previous: 100, pct: 12 });
    expect(compare(90, 100)).toEqual({ previous: 100, pct: -10 });
    expect(compare(5, 0)).toEqual({ previous: 0, pct: null });
  });
});
