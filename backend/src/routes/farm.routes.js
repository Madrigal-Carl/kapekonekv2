import { Router } from 'express';
import * as farms from '../controllers/farm.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { assignedFarmersSchema, farmListQuery, farmSchema, mapFarmsQuery } from '../schemas/farm.schema.js';

const router = Router();

// Scope (whose farm) is decided in farm.service by policy (PHASE-2-SPEC §2).
router.use('/farms', authenticate, verified, can('farms.manage'));
router.get('/farms', validate({ query: farmListQuery }), farms.list);
router.post('/farms', validate({ body: farmSchema }), farms.create);
router.get('/farms/:id', validate({ params: idParams }), farms.show);
router.patch('/farms/:id', validate({ params: idParams, body: farmSchema }), farms.update);
router.post('/farms/:id/archive', validate({ params: idParams }), farms.archive);
router.post('/farms/:id/restore', validate({ params: idParams }), farms.restore);
router.put('/farms/:id/assigned-farmers', validate({ params: idParams, body: assignedFarmersSchema }), farms.assignFarmers);

// The Farm Map: every role with map.view, scoped by the same policy as /farms.
router.get('/map/farms', authenticate, verified, can('map.view'), validate({ query: mapFarmsQuery }), farms.map);

export default router;
