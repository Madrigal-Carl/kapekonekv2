import { z } from 'zod';
import { insideMarinduque } from '../services/boundary.service.js';
import { getLocations } from '../services/location.service.js';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { associationDescriptionRule, associationNameRule } from './rules.js';

const MUNICIPALITIES = getLocations().map((m) => m.name);
const municipalityRule = z.enum(MUNICIPALITIES, 'Choose a municipality in Marinduque');

/** Add/edit body. `groupManagerId`: null = "Assign later"; left out = unchanged. */
export const associationSchema = z.object({
  name: associationNameRule,
  municipality: municipalityRule,
  description: associationDescriptionRule.default(''),
  groupManagerId: objectIdRule.nullable().optional(),
  // The meeting point pin (Change 08); null = the town's centre.
  location: z.object({ lat: z.number(), lng: z.number() }).refine(insideMarinduque, 'Put the pin inside Marinduque').nullable().optional(),
});

export const associationListQuery = pageQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'archived']).optional(),
  municipality: municipalityRule.optional(),
});
