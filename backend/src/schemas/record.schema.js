import { z } from 'zod';
import { VARIETIES } from '../constants/catalog.js';
import { HARVEST_PERIODS, TREE_STAGES } from '../constants/records.js';
import { objectIdRule, pageQuerySchema } from './common.schema.js';
import { pastDateRule, recordNoteRule, treeCountRule, yieldRule } from './rules.js';

const varietyRule = z.enum(Object.keys(VARIETIES), 'Choose a variety');
const recordFields = {
  farmId: objectIdRule,
  variety: varietyRule,
  note: recordNoteRule.optional().default(''),
};
const listFields = {
  q: z.string().trim().max(80).optional(),
  status: z.enum(['active', 'archived']).optional(),
  farmId: objectIdRule.optional(),
  variety: varietyRule.optional(),
};

/** Add/edit a tree group (PHASE-2-SPEC §3.6, §7). */
export const treeGroupSchema = z.object({
  ...recordFields,
  stage: z.enum(TREE_STAGES, 'Choose a stage'),
  count: treeCountRule,
  plantedAt: pastDateRule,
});
export const treeGroupListQuery = pageQuerySchema.extend({ ...listFields, stage: z.enum(TREE_STAGES).optional() });

/** Record/edit a harvest. The variety-has-trees check needs the farm, so it lives in harvest.service. */
export const harvestSchema = z.object({ ...recordFields, yieldKg: yieldRule, harvestedAt: pastDateRule });
export const harvestListQuery = pageQuerySchema.extend({ ...listFields, period: z.enum(HARVEST_PERIODS).optional() });
