import { z } from 'zod';
import { BEAN_FORMS, BEAN_STATUS_GROUPS } from '../constants/beans.js';
import { VARIETIES } from '../constants/catalog.js';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { beanAmountRule, beanFinalWeightRule, beanPhotosRule, beanPriceRule, beanWeightRule, cancelReasonRule, recordNoteRule } from './rules.js';

/** List or edit beans (PHASE-2-SPEC §3.5, §7). `farmerId`: the farmer a Group Manager lists for (ignored on edit). */
export const beanSchema = z.object({
  farmerId: objectIdRule.optional(),
  variety: z.enum(Object.keys(VARIETIES), 'Choose a variety'),
  form: z.enum(Object.keys(BEAN_FORMS), 'Choose a form'),
  weightKg: beanWeightRule,
  pricePerKgCentavos: beanPriceRule,
  photos: beanPhotosRule,
  note: recordNoteRule.optional().default(''),
});

export const beanListQuery = pageQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(Object.keys(BEAN_STATUS_GROUPS)).optional(),
  variety: z.enum(Object.keys(VARIETIES)).optional(),
  form: z.enum(Object.keys(BEAN_FORMS)).optional(),
  farmerId: objectIdRule.optional(),
});

export const beanCapQuery = z.object({ farmerId: objectIdRule.optional() });

/** Reject: the reason is required (PHASE-2-SPEC §3.5). */
export const beanRejectSchema = z.object({ reason: cancelReasonRule });
/** Cancel: Kaluppa must give a reason (checked in bean.service); the farmer's side may not. */
export const beanCancelSchema = z.object({ reason: cancelReasonRule.optional() });
/** Complete: the weight and amount at the branch; the listed values are kept beside them. */
export const beanCompleteSchema = z.object({ finalWeightKg: beanFinalWeightRule, finalAmountCentavos: beanAmountRule });
