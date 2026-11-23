import { Router } from 'express';
import * as harvests from '../controllers/harvest.controller.js';
import * as treeGroups from '../controllers/treeGroup.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { harvestListQuery, harvestSchema, treeGroupListQuery, treeGroupSchema } from '../schemas/record.schema.js';

const router = Router();

// Scope follows the farm, decided in farm.service by policy (PHASE-2-SPEC §2).
router.use('/tree-groups', authenticate, verified, can('trees.manage'));
router.get('/tree-groups', validate({ query: treeGroupListQuery }), treeGroups.list);
router.post('/tree-groups', validate({ body: treeGroupSchema }), treeGroups.create);
router.patch('/tree-groups/:id', validate({ params: idParams, body: treeGroupSchema }), treeGroups.update);
router.post('/tree-groups/:id/archive', validate({ params: idParams }), treeGroups.archive);
router.post('/tree-groups/:id/restore', validate({ params: idParams }), treeGroups.restore);

router.use('/harvests', authenticate, verified, can('harvests.manage'));
router.get('/harvests', validate({ query: harvestListQuery }), harvests.list);
router.post('/harvests', validate({ body: harvestSchema }), harvests.create);
router.patch('/harvests/:id', validate({ params: idParams, body: harvestSchema }), harvests.update);
router.post('/harvests/:id/archive', validate({ params: idParams }), harvests.archive);
router.post('/harvests/:id/restore', validate({ params: idParams }), harvests.restore);

export default router;
