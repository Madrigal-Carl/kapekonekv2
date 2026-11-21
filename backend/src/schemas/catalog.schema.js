import { z } from 'zod';
import { COFFEE_TYPES, PRODUCT_SORTS, VARIETIES } from '../constants/catalog.js';
import { pageQuery } from './common.schema.js';
import { ratingRule, reviewCommentRule } from './rules.js';

/** "a,b" → ['a','b'], each one of `values`. */
const csvOf = (values, message) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(values, message)));

const peso = z.coerce.number('Enter a number').min(0, 'Enter 0 or more').optional();

export const productListQuery = pageQuery(24, 12).extend({
  search: z.string().trim().max(80).optional(),
  category: z.string().trim().toLowerCase().max(60).optional(),
  variety: csvOf(Object.keys(VARIETIES), 'Unknown variety'),
  coffeeType: csvOf(Object.keys(COFFEE_TYPES), 'Unknown coffee type'),
  minPrice: peso,
  maxPrice: peso,
  featured: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
  sort: z.enum(Object.keys(PRODUCT_SORTS), 'Unknown sort').default('newest'),
});

export const createReviewSchema = z.object({ rating: ratingRule, comment: reviewCommentRule });

export const updateReviewSchema = z
  .object({ rating: ratingRule.optional(), comment: reviewCommentRule.optional() })
  .refine((v) => v.rating !== undefined || v.comment !== undefined, 'Change the rating or the review');
