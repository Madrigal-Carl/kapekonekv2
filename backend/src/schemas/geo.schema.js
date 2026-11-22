import { z } from 'zod';
import { isValidBarangay } from '../services/location.service.js';
import { objectIdRule } from './common.schema.js';

const lat = z.coerce.number('Enter a latitude').min(-90).max(90);
const lng = z.coerce.number('Enter a longitude').min(-180).max(180);

export const pointQuery = z.object({ lat, lng });

/** A free-text search (`q`), or a barangay lookup (`municipality` + `barangay`, which must belong to it). */
export const searchQuery = z
  .object({
    q: z.string().trim().min(2, 'Type at least 2 characters').max(120).optional(),
    municipality: z.string().trim().max(60).optional(),
    barangay: z.string().trim().max(80).optional(),
  })
  .refine((s) => s.q || (s.municipality && s.barangay), { message: 'Type at least 2 characters', path: ['q'] })
  .refine((s) => !s.barangay || isValidBarangay(s.municipality, s.barangay), { message: 'Choose a barangay of that municipality', path: ['barangay'] });

/** Either `addressId` or `lat` + `lng`. */
export const quoteQuery = z
  .object({ addressId: objectIdRule.optional(), lat: lat.optional(), lng: lng.optional() })
  .refine((q) => q.addressId || (q.lat != null && q.lng != null), { message: 'Choose an address or a map point', path: ['addressId'] });
