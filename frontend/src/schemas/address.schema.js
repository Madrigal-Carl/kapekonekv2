import { z } from 'zod'
import { customLabelRule, phoneRule, recipientNameRule, streetRule } from './rules'

// Farm shows only for people with farms (farms.manage); the server checks it too.
export const ADDRESS_LABELS = ['Home', 'Work', 'Farm', 'Other']

/** Same rules as the backend's addressSchema; the barangay list itself is checked by the API. */
export const addressSchema = z
  .object({
    label: z.enum(ADDRESS_LABELS, 'Choose a label'),
    customLabel: customLabelRule.optional(),
    recipientName: recipientNameRule,
    phone: phoneRule,
    municipality: z.string().min(1, 'Choose a municipality in Marinduque'),
    barangay: z.string().min(1, 'Choose a barangay'),
    street: streetRule,
    location: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    isDefault: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.label === 'Other' && !value.customLabel) {
      ctx.addIssue({ code: 'custom', path: ['customLabel'], message: 'Name this address, e.g. "Mama’s house"' })
    }
  })
