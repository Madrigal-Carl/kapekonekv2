import { describe, expect, it } from 'vitest';
import { addBusinessDays, etaWindow } from '../src/utils/businessDays.js';
import { manilaDateKey } from '../src/utils/manilaDate.js';

const day = (date) => manilaDateKey(date);

describe('business days (Mon–Fri, Manila calendar)', () => {
  it('from a Friday, 3–5 business days is Wednesday to Friday next week', () => {
    const { from, to } = etaWindow(new Date('2026-11-20T02:00:00Z'), { minBusinessDays: 3, maxBusinessDays: 5 });
    expect([day(from), day(to)]).toEqual(['20261125', '20261127']);
  });

  it('counts from the Manila date, not the UTC date', () => {
    // 2026-11-23T17:00Z is Monday in UTC but already Tuesday 1 AM in Manila.
    const { from, to } = etaWindow(new Date('2026-11-23T17:00:00Z'), { minBusinessDays: 3, maxBusinessDays: 5 });
    expect([day(from), day(to)]).toEqual(['20261127', '20261201']);
  });

  it('skips the weekend when starting on a Saturday', () => {
    expect(day(addBusinessDays(new Date('2026-11-21T03:00:00Z'), 1))).toBe('20261123');
  });
});
