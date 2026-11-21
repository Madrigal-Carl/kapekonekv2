// Shared field rules. frontend/src/schemas/rules.js is an identical copy — change both together.
import { z } from 'zod';

export const PASSWORD_RULE = 'At least 8 characters with a letter, a number and a special character';
export const USERNAME_RULE = '3–30 characters: lowercase letters, numbers, dots or underscores';

export const passwordRule = z
  .string()
  .max(72, 'Use 72 characters or fewer') // bcrypt ignores anything past 72 bytes
  .refine((v) => v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v), PASSWORD_RULE);

export const usernameRule = z.string().trim().regex(/^[a-z0-9._]{3,30}$/, USERNAME_RULE);

export const nameRule = z.string().trim().min(1, 'This field is required').max(50, 'Use 50 characters or fewer');

export const optionalNameRule = z
  .string()
  .trim()
  .max(50, 'Use 50 characters or fewer')
  .optional()
  .nullable()
  .transform((v) => v || null);

export const emailRule = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

export const phoneRule = z
  .string()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^09\d{9}$/, 'Use an 11-digit mobile number starting with 09'));

export const ratingRule = z.coerce
  .number('Choose a rating from 1 to 5')
  .int('Choose a rating from 1 to 5')
  .min(1, 'Choose a rating from 1 to 5')
  .max(5, 'Choose a rating from 1 to 5');

export const reviewCommentRule = z
  .string('Write your review')
  .trim()
  .min(10, 'Write at least 10 characters')
  .max(1000, 'Use 1000 characters or fewer');

export const recipientNameRule = z
  .string('Enter the recipient name')
  .trim()
  .min(2, 'Enter at least 2 characters')
  .max(80, 'Use 80 characters or fewer');

export const streetRule = z
  .string('Enter the street, house number or a landmark')
  .trim()
  .min(5, 'Add the street, house number or a landmark (at least 5 characters)')
  .max(200, 'Use 200 characters or fewer');

export const customLabelRule = z.string().trim().max(30, 'Use 30 characters or fewer');

/** Quantity steps by unit: kg in 0.5 steps (min 0.5); packs and pieces whole (min 1). */
export const QUANTITY_STEP = { kg: 0.5, pack: 1, piece: 1 };

/** @param {'kg'|'pack'|'piece'} unit */
export const quantityRule = (unit) => {
  const step = QUANTITY_STEP[unit] ?? 1;
  return z
    .number('Enter a quantity')
    .min(step, `The minimum is ${step}`)
    .refine((q) => Number.isInteger(q / step), unit === 'kg' ? 'Use 0.5 kg steps' : 'Use whole numbers');
};

export const cancelReasonRule = z
  .string()
  .trim()
  .min(5, 'Tell us a little more (at least 5 characters)')
  .max(300, 'Use 300 characters or fewer');
