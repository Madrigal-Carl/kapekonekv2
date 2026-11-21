// The same table runs in backend/tests/rules.test.js — keep them identical.
import { describe, expect, it } from 'vitest';
import {
  cancelReasonRule, customLabelRule, passwordRule, phoneRule, quantityRule, ratingRule, recipientNameRule, reviewCommentRule, streetRule, usernameRule,
} from './rules.js';

const ok = (rule, value) => rule.safeParse(value).success;

describe('shared rules', () => {
  it.each([
    ['Password123!', true],
    ['password1', false],
    ['Pass!', false],
    ['!!!!1111', false],
  ])('password %s → %s', (value, expected) => expect(ok(passwordRule, value)).toBe(expected));

  it.each([
    ['juan.dc_1', true],
    ['Ju', false],
    ['UPPER', false],
    ['has space', false],
    ['a'.repeat(31), false],
  ])('username %s → %s', (value, expected) => expect(ok(usernameRule, value)).toBe(expected));

  it.each([
    ['0917 555 0102', true],
    ['+639175550102', false],
  ])('phone %s → %s', (value, expected) => expect(ok(phoneRule, value)).toBe(expected));

  it('strips spaces from phone numbers', () => {
    expect(phoneRule.parse('0917 555 0102')).toBe('09175550102');
  });

  it.each([
    [5, true],
    ['3', true],
    [0, false],
    [4.5, false],
  ])('rating %s → %s', (value, expected) => expect(ok(ratingRule, value)).toBe(expected));

  it.each([
    ['Bold and smoky.', true],
    ['   too short   ', false],
    ['x'.repeat(1001), false],
  ])('review comment %s → %s', (value, expected) => expect(ok(reviewCommentRule, value)).toBe(expected));

  it.each([
    ['kg', 0.5, true],
    ['kg', 1.5, true],
    ['kg', 0.75, false],
    ['kg', 0, false],
    ['pack', 2, true],
    ['pack', 1.5, false],
    ['piece', 0, false],
  ])('quantity %s %s → %s', (unit, value, expected) => expect(ok(quantityRule(unit), value)).toBe(expected));

  it.each([
    [recipientNameRule, 'J', false],
    [recipientNameRule, 'Juana Dela Cruz', true],
    [streetRule, 'Lot', false],
    [streetRule, 'Lot 12, Purok 3', true],
    [customLabelRule, 'x'.repeat(31), false],
    [cancelReasonRule, 'nope', false],
    [cancelReasonRule, 'Found a closer seller', true],
  ])('address and cancel rules %#', (rule, value, expected) => expect(ok(rule, value)).toBe(expected));
});
