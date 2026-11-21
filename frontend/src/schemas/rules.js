// Shared field rules. backend/src/schemas/rules.js is an identical copy — change both together.
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
