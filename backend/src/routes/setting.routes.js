import { Router } from 'express';
import * as settings from '../controllers/setting.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { boundariesQuery } from '../schemas/geo.schema.js';

const router = Router();

router.get('/locations', settings.locations);
router.get('/locations/boundaries', validate({ query: boundariesQuery }), settings.boundaries);
router.get('/delivery/info', settings.deliveryInfo);
router.get('/settings/landing', settings.landing);
router.get('/settings/payment', authenticate, verified, settings.payment);

export default router;
