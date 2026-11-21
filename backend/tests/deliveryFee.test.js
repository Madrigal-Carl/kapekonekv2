import { describe, expect, it } from 'vitest';
import { SETTING_DEFAULTS } from '../src/constants/settings.js';
import { feeForDistance, haversineKm } from '../src/utils/deliveryFee.js';
import { manilaDateKey } from '../src/utils/manilaDate.js';

const rules = SETTING_DEFAULTS['delivery.fee'];

describe('feeForDistance', () => {
  it.each([
    [0, 5000],
    [3, 5000],
    [3.1, 5500], // 5000 + 100 → rounded up to the next ₱5
    [7.3, 9500], // 5000 + 4300 → 9300 → 9500
    [10, 12000],
  ])('%s km → %s centavos', (km, fee) => expect(feeForDistance(km, rules)).toBe(fee));
});

describe('haversineKm', () => {
  it('measures straight-line distance', () => {
    expect(haversineKm({ lat: 13.467, lng: 122.044 }, { lat: 13.467, lng: 122.044 })).toBe(0);
    expect(haversineKm({ lat: 13.467, lng: 122.044 }, { lat: 13.447, lng: 121.84 })).toBeCloseTo(22.2, 0);
  });
});

describe('manilaDateKey', () => {
  it('uses the Manila calendar date, not UTC', () => {
    expect(manilaDateKey(new Date('2026-11-23T17:00:00Z'))).toBe('20261124');
    expect(manilaDateKey(new Date('2026-11-23T15:59:00Z'))).toBe('20261123');
  });
});
