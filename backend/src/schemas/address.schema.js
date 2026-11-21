import { z } from 'zod';
import { ADDRESS_LABELS, insideBounds } from '../constants/geo.js';
import { getLocations, isValidBarangay } from '../services/location.service.js';
import { customLabelRule, phoneRule, recipientNameRule, streetRule } from './rules.js';

const MUNICIPALITIES = getLocations().map((m) => m.name);

/** Add/edit body. Province and postal code are derived on the server; a `location` of null removes the pin. */
export const addressSchema = z
  .object({
    label: z.enum(ADDRESS_LABELS, 'Choose Home, Work or Other'),
    customLabel: customLabelRule.optional().nullable(),
    recipientName: recipientNameRule,
    phone: phoneRule,
    municipality: z.enum(MUNICIPALITIES, 'Choose a municipality in Marinduque'),
    barangay: z.string('Choose a barangay').trim().min(1, 'Choose a barangay'),
    street: streetRule,
    location: z
      .object({ lat: z.number(), lng: z.number() })
      .refine(insideBounds, 'That spot is outside our delivery area. We deliver anywhere in Marinduque.')
      .nullable()
      .optional(),
    isDefault: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!isValidBarangay(value.municipality, value.barangay)) {
      ctx.addIssue({ code: 'custom', path: ['barangay'], message: `Choose a barangay in ${value.municipality}` });
    }
    if (value.label === 'Other' && !value.customLabel) {
      ctx.addIssue({ code: 'custom', path: ['customLabel'], message: 'Name this address, e.g. "Mama’s house"' });
    }
  });
