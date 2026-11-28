import { z } from 'zod';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { cancelReasonRule, emailRule, nameRule, optionalNameRule, phoneRule, usernameRule } from './rules.js';

/** An upload the browser just finished (Cloudinary `secure_url` + `public_id`). */
const uploadRef = (label) => z.object({ url: z.url().max(500), publicId: z.string().min(1).max(300) }, `Upload your ${label}`);

/** Rejection, transfer-rejection and removal reasons (PHASE-2-SPEC §7: 5–300 characters). */
export const reasonSchema = z.object({ reason: cancelReasonRule });

export const associationRequestSchema = z.object({
  associationId: objectIdRule,
  // Optional when resending after a rejection: the documents already on file are reused.
  validId: uploadRef('valid ID').optional(),
  landProof: uploadRef('proof of land ownership').optional(),
});

/** Replace one or both documents on file (FarmerAssociation.dc.html "Replace"). */
export const documentReplaceSchema = z
  .object({ validId: uploadRef('valid ID').optional(), landProof: uploadRef('proof of land ownership').optional() })
  .refine((d) => d.validId || d.landProof, { message: 'Upload a document', path: ['validId'] });

export const transferRequestSchema = z.object({
  associationId: objectIdRule,
  reason: z.string().trim().max(300, 'Use 300 characters or fewer').optional().default(''),
});

/** A Group Manager adds or edits a farmer. Email is required on create (Change 08); older username-only farmers may still have none. */
const farmerFields = {
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  email: z.union([z.literal(''), emailRule]).nullish().transform((v) => v || null),
  contactNumber: phoneRule,
  validId: uploadRef('valid ID').nullable().optional(),
  landProof: uploadRef('proof of land ownership').nullable().optional(),
};
export const farmerCreateSchema = z.object({ ...farmerFields, email: emailRule, associationId: objectIdRule.optional() });
export const farmerUpdateSchema = z.object(farmerFields);

export const farmerListQuery = pageQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  associationId: objectIdRule.optional(), // Kaluppa only; a Group Manager stays in its own association
});
