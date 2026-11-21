import { z } from 'zod';

export const objectIdRule = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
export const idParams = z.object({ id: objectIdRule });
export const slugParams = z.object({ slug: z.string().trim().toLowerCase().min(1).max(120) });

export const pageQuery = (max, fallback) =>
  z.object({
    cursor: z.string().max(500).optional(),
    limit: z.coerce.number().int().min(1).max(max, `At most ${max} per page`).default(fallback),
  });
