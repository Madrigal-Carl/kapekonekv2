import { Router } from 'express';
import * as dashboard from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { overviewQuery } from '../schemas/dashboard.schema.js';

const router = Router();
router.use('/dashboard', authenticate, verified, can('dashboard.view'));
router.get('/dashboard/badges', dashboard.badges);
router.get('/dashboard/org', dashboard.org);
router.get('/dashboard/overview', validate({ query: overviewQuery }), dashboard.overview);

export default router;
