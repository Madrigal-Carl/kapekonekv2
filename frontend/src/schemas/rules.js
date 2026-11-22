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

/**
 * A quantity as a whole number of unit steps (2.5 kg → 5), so totals compare without float drift.
 * @param {'kg'|'pack'|'piece'} unit
 * @param {number} quantity
 */
export const toSteps = (unit, quantity) => Math.round(quantity / (QUANTITY_STEP[unit] ?? 1));

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

const MB = 1024 * 1024;

/**
 * Upload limits (PRODUCT-SPEC §9). Checked in the browser before uploading and again on the server
 * from Cloudinary's stored `bytes` and `format`.
 */
export const UPLOAD_RULES = {
  image: {
    formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    maxBytes: 5 * MB,
    noun: 'Images',
    hint: 'JPG, PNG, WebP or HEIC · up to 5 MB',
  },
  file: {
    formats: ['pdf'],
    mimeTypes: ['application/pdf'],
    maxBytes: 10 * MB,
    noun: 'Files',
    hint: 'PDF · up to 10 MB',
  },
  video: {
    formats: ['mp4', 'webm'],
    mimeTypes: ['video/mp4', 'video/webm'],
    maxBytes: 50 * MB,
    noun: 'Videos',
    hint: 'MP4 or WebM · up to 50 MB',
  },
};

/** The kinds each upload purpose accepts (PHASE-2-SPEC §5 Uploads). Video is for Hub posts only. */
export const UPLOAD_PURPOSES = {
  avatar: ['image'],
  receipt: ['image'],
  farmer_document: ['image', 'file'],
  post_media: ['image', 'video'],
};

/**
 * Which rule a file of this format follows for this purpose, or null when the purpose doesn't take it.
 * @param {keyof typeof UPLOAD_PURPOSES} purpose
 * @param {string} format extension, e.g. `pdf`
 * @returns {'image'|'file'|'video'|null}
 */
export const kindForFormat = (purpose, format) =>
  UPLOAD_PURPOSES[purpose]?.find((kind) => UPLOAD_RULES[kind].formats.includes(format.toLowerCase())) ?? null;

/** "7.2 MB" */
export const formatMegabytes = (bytes) => `${(bytes / MB).toFixed(1)} MB`;

/**
 * The two lines of the "too large" message: `["receipt.png is 7.2 MB.", "Images can be up to 5 MB."]`.
 * @param {'image'|'file'|'video'} kind
 */
export const tooLargeLines = (kind, name, bytes) => [
  // A file just over the limit never reads as the limit ("5.0 MB … up to 5 MB").
  `${name} is ${formatMegabytes(Math.max(bytes, UPLOAD_RULES[kind].maxBytes + 0.1 * MB))}.`,
  `${UPLOAD_RULES[kind].noun} can be up to ${UPLOAD_RULES[kind].maxBytes / MB} MB.`,
];

/**
 * A file to upload, described as `{ name, size, format }` (`format` = extension, e.g. `png`), so the browser
 * (File) and the server (Cloudinary `bytes` / `format`) check the same thing.
 * @param {'image'|'file'|'video'} kind
 */
export const uploadRule = (kind) =>
  z
    .object({ name: z.string(), size: z.number().nonnegative(), format: z.string() })
    .superRefine(({ name, size, format }, ctx) => {
      const rule = UPLOAD_RULES[kind];
      if (!rule.formats.includes(format.toLowerCase())) {
        ctx.addIssue({ code: 'custom', path: ['format'], message: `${name} isn't a supported type. Use ${rule.hint.split(' · ')[0]}.`, params: { code: 'FILE_TYPE_NOT_ALLOWED' } });
      } else if (size > rule.maxBytes) {
        ctx.addIssue({ code: 'custom', path: ['size'], message: tooLargeLines(kind, name, size).join(' '), params: { code: 'FILE_TOO_LARGE' } });
      }
    });
