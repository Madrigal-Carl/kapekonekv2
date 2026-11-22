// The same table runs in backend/tests/rules.test.js — keep them identical.
import { describe, expect, it } from 'vitest';
import {
  associationDescriptionRule, associationNameRule, cancelReasonRule, customLabelRule, kindForFormat, passwordRule, phoneRule, quantityRule, ratingRule, recipientNameRule, reviewCommentRule, streetRule, uploadRule, usernameRule,
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
    [associationNameRule, 'B', false],
    [associationNameRule, 'Boac Highland Growers', true],
    [associationDescriptionRule, 'x'.repeat(501), false],
  ])('address and cancel rules %#', (rule, value, expected) => expect(ok(rule, value)).toBe(expected));
});

describe('UPLOAD_RULES', () => {
  const MB = 1024 * 1024;
  it('allows images up to 5 MB, pdf files up to 10 MB and videos up to 50 MB, by the byte', () => {
    expect(uploadRule('image').safeParse({ name: 'a.png', size: 5 * MB, format: 'png' }).success).toBe(true);
    const over = uploadRule('image').safeParse({ name: 'receipt.png', size: 5 * MB + 1, format: 'png' });
    expect(over.error.issues[0]).toMatchObject({ message: 'receipt.png is 5.1 MB. Images can be up to 5 MB.', params: { code: 'FILE_TOO_LARGE' } });
    expect(uploadRule('file').safeParse({ name: 'a.pdf', size: 10 * MB, format: 'pdf' }).success).toBe(true);
    expect(uploadRule('file').safeParse({ name: 'a.pdf', size: 10 * MB + 1, format: 'pdf' }).success).toBe(false);
    expect(uploadRule('image').safeParse({ name: 'a.pdf', size: 10, format: 'pdf' }).error.issues[0].params.code).toBe('FILE_TYPE_NOT_ALLOWED');
    expect(uploadRule('file').safeParse({ name: 'a.mp4', size: 10, format: 'mp4' }).success).toBe(false); // file = pdf only
    expect(uploadRule('video').safeParse({ name: 'a.mp4', size: 50 * MB, format: 'mp4' }).success).toBe(true);
    expect(uploadRule('video').safeParse({ name: 'a.mp4', size: 50 * MB + 1, format: 'mp4' }).success).toBe(false);
  });

  it('picks the kind from the purpose and the format; video only for post_media', () => {
    expect([kindForFormat('avatar', 'PNG'), kindForFormat('receipt', 'pdf')]).toEqual(['image', null]);
    expect([kindForFormat('farmer_document', 'jpg'), kindForFormat('farmer_document', 'pdf')]).toEqual(['image', 'file']);
    for (const purpose of ['avatar', 'receipt', 'farmer_document']) expect(kindForFormat(purpose, 'mp4')).toBeNull();
    expect(kindForFormat('post_media', 'mp4')).toBe('video');
  });
});
