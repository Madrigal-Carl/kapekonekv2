// The same table runs in backend/tests/rules.test.js — keep them identical.
import { describe, expect, it } from 'vitest';
import { passwordRule, phoneRule, usernameRule } from './rules.js';

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
});
