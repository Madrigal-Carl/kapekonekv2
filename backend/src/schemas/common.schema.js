import { z } from 'zod';

export const objectIdRule = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectIdRule });
export const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(120) });

export const pageQuery = (max, fallback) =>
  z.object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(max, `At most ${max} per page`).default(fallback),
  });

/** Numbered pages for dashboard tables: 10 rows by default, up to 50. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50, 'At most 50 per page').default(10),
});

/** "a,b" → ['a','b'], each one of `values`. */
export const csvOf = (values, message) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))
    .pipe(z.array(z.enum(values, message)));

