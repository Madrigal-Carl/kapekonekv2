import { Router } from 'express';
import * as associations from '../controllers/association.controller.js';
import * as groupManagers from '../controllers/groupManager.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { associationListQuery, associationSchema } from '../schemas/association.schema.js';
import { idParams } from '../schemas/common.schema.js';
import { groupManagerListQuery, groupManagerSchema } from '../schemas/groupManager.schema.js';

const router = Router();

// Any signed-in user, for the farmer's "Join your association" window.
router.get('/associations/options', authenticate, verified, associations.options);

router.use('/associations', authenticate, can('associations.manage'));
router.get('/associations', validate({ query: associationListQuery }), associations.list);
router.post('/associations', validate({ body: associationSchema }), associations.create);
router.get('/associations/:id', validate({ params: idParams }), associations.show);
router.patch('/associations/:id', validate({ params: idParams, body: associationSchema }), associations.update);
router.post('/associations/:id/archive', validate({ params: idParams }), associations.archive);
router.post('/associations/:id/restore', validate({ params: idParams }), associations.restore);

router.use('/group-managers', authenticate, can('group_managers.manage'));
router.get('/group-managers', validate({ query: groupManagerListQuery }), groupManagers.list);
router.post('/group-managers', validate({ body: groupManagerSchema }), groupManagers.create);
router.get('/group-managers/:id', validate({ params: idParams }), groupManagers.show);
router.patch('/group-managers/:id', validate({ params: idParams, body: groupManagerSchema }), groupManagers.update);
router.post('/group-managers/:id/reset-password', can('users.reset_password'), validate({ params: idParams }), groupManagers.resetPassword);
router.post('/group-managers/:id/archive', validate({ params: idParams }), groupManagers.archive);
router.post('/group-managers/:id/restore', validate({ params: idParams }), groupManagers.restore);

export default router;
