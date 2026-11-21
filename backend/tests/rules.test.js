// The same table runs in frontend/src/schemas/rules.test.js — keep them identical.
import { describe, expect, it } from 'vitest';
import { passwordRule, phoneRule, ratingRule, reviewCommentRule, usernameRule } from '../src/schemas/rules.js';

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
});
