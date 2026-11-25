import { z } from 'zod';
import { getLocations } from '../services/location.service.js';
import { objectIdRule } from './common.schema.js';

const lat = z.coerce.number('Enter a latitude').min(-90).max(90);
const lng = z.coerce.number('Enter a longitude').min(-180).max(180);

export const pointQuery = z.object({ lat, lng });

/** A free-text place search. */
export const searchQuery = z.object({ q: z.string('Type at least 2 characters').trim().min(2, 'Type at least 2 characters').max(120) });

const MUNICIPALITY_NAMES = getLocations().map((m) => m.name);

/** `level=municipality`, or `level=barangay&municipality=<name>`. */
export const boundariesQuery = z
  .object({
    level: z.enum(['municipality', 'barangay'], 'Choose municipality or barangay'),
    municipality: z.enum(MUNICIPALITY_NAMES, 'Choose a municipality in Marinduque').optional(),
  })
  .refine((q) => q.level === 'municipality' || q.municipality, { message: 'Choose a municipality in Marinduque', path: ['municipality'] });

/** Either `addressId` or `lat` + `lng`. */
export const quoteQuery = z
  .object({ addressId: objectIdRule.optional(), lat: lat.optional(), lng: lng.optional() })
  .refine((q) => q.addressId || (q.lat != null && q.lng != null), { message: 'Choose an address or a map point', path: ['addressId'] });
