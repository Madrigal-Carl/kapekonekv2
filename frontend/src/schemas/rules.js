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

export const associationNameRule = z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Use 80 characters or fewer');
export const associationDescriptionRule = z.string().trim().max(500, 'Use 500 characters or fewer');

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
  bean_photo: ['image'],
  product_photo: ['image'],
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

// Records (PHASE-2-SPEC §7). Mirrors backend/src/schemas/rules.js.
export const lotNumberRule = z.string('Enter the lot number').trim().min(1, 'Enter the lot number').max(40, 'Use 40 characters or fewer');
export const farmSizeRule = z
  .number('Enter the size in hectares')
  .min(0.01, 'Enter at least 0.01 hectares')
  .max(500, 'Enter 500 hectares or less');
export const farmStreetRule = z.string().trim().max(200, 'Use 200 characters or fewer');

/** Manila "YYYY-MM-DD" for today (the server runs in UTC; date inputs send local calendar days). */
export const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
export const pastDateRule = z.iso.date('Pick a date').refine((day) => day <= todayKey(), 'Pick today or an earlier date');
export const treeCountRule = z.number('Enter the number of trees').int('Use a whole number').min(1, 'Enter at least 1 tree').max(100_000, 'Enter 100,000 trees or fewer');
export const yieldRule = z
  .number('Enter the yield in kg')
  .min(0.5, 'Enter at least 0.5 kg')
  .max(100_000, 'Enter 100,000 kg or less')
  .refine((kg) => Number.isInteger(kg * 2), 'Use steps of 0.5 kg');
export const recordNoteRule = z.string().trim().max(500, 'Use 500 characters or fewer');

// Bean listings (PHASE-2-SPEC §7). Mirrors backend/src/schemas/rules.js.
export const beanWeightRule = z
  .number('Enter the weight in kg')
  .min(0.5, 'Enter at least 0.5 kg')
  .max(10_000, 'Enter 10,000 kg or less')
  .refine((kg) => Number.isInteger(kg * 2), 'Use steps of 0.5 kg');
/** Price per kg in centavos: ₱1 to ₱10,000. */
export const beanPriceRule = z
  .number('Enter your price per kg')
  .int('Use whole centavos')
  .min(100, 'Enter at least ₱1 per kg')
  .max(1_000_000, 'Enter ₱10,000 per kg or less');
export const beanPhotosRule = z
  .array(z.object({ url: z.url().max(500), publicId: z.string().min(1).max(300) }), 'Add at least 1 photo')
  .min(1, 'Add at least 1 photo')
  .max(5, 'Add up to 5 photos');
/** What Kaluppa weighed at the branch: any weight to 2 decimals (the listed weight uses 0.5 kg steps). */
export const beanFinalWeightRule = z
  .number('Enter the weight measured at the branch')
  .gt(0, 'Enter more than 0 kg')
  .max(10_000, 'Enter 10,000 kg or less')
  .refine((kg) => Math.abs(kg * 100 - Math.round(kg * 100)) < 1e-6, 'Use up to 2 decimals');
/** What Kaluppa paid, in centavos: ₱1 to ₱1,000,000. */
export const beanAmountRule = z
  .number('Enter the amount paid')
  .int('Use whole centavos')
  .min(100, 'Enter at least ₱1')
  .max(100_000_000, 'Enter ₱1,000,000 or less');

// Inventory (PHASE-2-SPEC §4). Mirrored in the other app's rules.js.
/** What each store category allows: its units, whether it has a variety / coffee type, and Featured (coffee only). */
export const PRODUCT_CATEGORIES = {
  coffee: { units: ['pack', 'kg'], variety: true, coffeeType: true, featured: true },
  fertilizer: { units: ['sack', 'kg'] },
  seedlings: { units: ['piece'], variety: true },
};
/** Price in centavos: ₱1 to ₱100,000. */
export const productPriceRule = z
  .number('Enter the price')
  .int('Use whole centavos')
  .min(100, 'Enter at least ₱1')
  .max(10_000_000, 'Enter ₱100,000 or less');
export const productStockRule = z.number('Enter the stock').min(0, 'Enter 0 or more').max(100_000, 'Enter 100,000 or less');
/** Up to five photos; at most one marked as the thumbnail (none → the first). */
export const productPhotosRule = z
  .array(z.object({ url: z.url().max(500), publicId: z.string().min(1).max(300), isThumbnail: z.boolean().default(false) }), 'Add at least 1 photo')
  .min(1, 'Add at least 1 photo')
  .max(5, 'Add up to 5 photos')
  .refine((photos) => photos.filter((p) => p.isThumbnail).length <= 1, 'Pick one thumbnail');
/** The category-dependent checks of a product form (`superRefine`). */
export function refineProductCategory(p, ctx) {
  const rules = PRODUCT_CATEGORIES[p.category];
  if (!rules) return;
  const issue = (path, message) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (!rules.units.includes(p.unit)) issue('unit', `Choose ${rules.units.join(' or ')}`);
  else if (!Number.isInteger(p.unit === 'kg' ? p.stock * 2 : p.stock)) issue('stock', p.unit === 'kg' ? 'Use steps of 0.5 kg' : 'Use whole numbers');
  if (rules.variety && !p.variety) issue('variety', 'Choose a variety');
  if (rules.coffeeType && !p.coffeeType) issue('coffeeType', 'Choose a coffee type');
  if (p.isFeatured && !rules.featured) issue('isFeatured', 'Only coffee can be featured on the landing page');
}
