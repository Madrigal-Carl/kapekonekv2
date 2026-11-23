import { z } from 'zod';
import { insideBounds } from '../constants/geo.js';
import { getLocations, isValidBarangay } from '../services/location.service.js';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { farmSizeRule, farmStreetRule, lotNumberRule } from './rules.js';

const MUNICIPALITIES = getLocations().map((m) => m.name);
const municipalityRule = z.enum(MUNICIPALITIES, 'Choose a municipality in Marinduque');

/**
 * Add/edit body (PHASE-2-SPEC §3.6, §7). `farmerId`: the owner when a Group Manager adds a farm (ignored on edit).
 * `managedById`: Kaluppa farms only; null = "Assign later".
 */
export const farmSchema = z
  .object({
    farmerId: objectIdRule.optional(),
    managedById: objectIdRule.nullable().optional(),
    lotNumber: lotNumberRule,
    sizeHa: farmSizeRule,
    municipality: municipalityRule,
    barangay: z.string('Choose a barangay').trim().min(1, 'Choose a barangay'),
    street: farmStreetRule.optional().default(''),
    location: z
      .object({ lat: z.number(), lng: z.number() }, 'Drop the farm pin on the map')
      .refine(insideBounds, 'Put the pin on the farm, inside Marinduque'),
  })
  .superRefine((value, ctx) => {
    if (!isValidBarangay(value.municipality, value.barangay)) {
      ctx.addIssue({ code: 'custom', path: ['barangay'], message: `Choose a barangay in ${value.municipality}` });
    }
  });

export const farmListQuery = pageQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'archived']).optional(),
  municipality: municipalityRule.optional(),
  ownerType: z.enum(['farmer', 'kaluppa']).optional(),
  farmerId: objectIdRule.optional(),
});

export const assignedFarmersSchema = z.object({ farmerIds: z.array(objectIdRule).max(200, 'Assign at most 200 farmers') });
