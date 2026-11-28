import { Router } from 'express';
import * as settings from '../controllers/adminSetting.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { branchSettingSchema, deliverySettingSchema, ewalletSettingSchema } from '../schemas/setting.schema.js';

// Kaluppa's Settings (PHASE-2-SPEC §3.13): branch, delivery fee, e-wallet.
const router = Router();
router.use('/admin/settings', authenticate, verified, can('settings.manage'));
router.get('/admin/settings/branch', settings.branch);
router.patch('/admin/settings/branch', validate({ body: branchSettingSchema }), settings.saveBranch);
router.get('/admin/settings/delivery', settings.delivery);
router.patch('/admin/settings/delivery', validate({ body: deliverySettingSchema }), settings.saveDelivery);
router.get('/admin/settings/ewallet', settings.ewallet);
router.patch('/admin/settings/ewallet', validate({ body: ewalletSettingSchema }), settings.saveEwallet);

export default router;
