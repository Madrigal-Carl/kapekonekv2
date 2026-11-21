import { z } from 'zod';
import { objectIdRule } from './common.schema.js';

const lat = z.coerce.number('Enter a latitude').min(-90).max(90);
const lng = z.coerce.number('Enter a longitude').min(-180).max(180);

export const pointQuery = z.object({ lat, lng });

export const searchQuery = z.object({ q: z.string().trim().min(2, 'Type at least 2 characters').max(120) });

/** Either `addressId` or `lat` + `lng`. */
export const quoteQuery = z
  .object({ addressId: objectIdRule.optional(), lat: lat.optional(), lng: lng.optional() })
  .refine((q) => q.addressId || (q.lat != null && q.lng != null), { message: 'Choose an address or a map point', path: ['addressId'] });
