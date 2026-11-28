import { z } from 'zod';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { emailRule, nameRule, optionalNameRule, phoneRule, usernameRule } from './rules.js';

/** Add/edit body. `associationId`: null = "Assign later". */
export const groupManagerSchema = z.object({
  firstName: nameRule,
  middleName: optionalNameRule,
  lastName: nameRule,
  username: usernameRule,
  email: emailRule,
  contactNumber: phoneRule,
  associationId: objectIdRule.nullable().default(null),
});

export const groupManagerListQuery = pageQuerySchema.extend({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'unassigned', 'archived']).optional(),
});
