import { Router } from 'express';
import * as farmers from '../controllers/farmer.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import {
  associationRequestSchema,
  farmerCreateSchema,
  farmerListQuery,
  farmerUpdateSchema,
  reasonSchema,
  transferRequestSchema,
} from '../schemas/farmer.schema.js';

const router = Router();

router.use('/me/farmer-profile', authenticate, verified, can('association.request'));
router.get('/me/farmer-profile', farmers.showMine);
router.post('/me/farmer-profile/request', validate({ body: associationRequestSchema }), farmers.requestToJoin);
router.post('/me/farmer-profile/transfer', validate({ body: transferRequestSchema }), farmers.requestTransfer);
router.delete('/me/farmer-profile/transfer', farmers.withdrawTransfer);

const manage = [authenticate, can('farmers.manage')];
const decide = [authenticate, can('farmers.approve')];
router.get('/farmers', manage, validate({ query: farmerListQuery }), farmers.list);
router.post('/farmers', manage, validate({ body: farmerCreateSchema }), farmers.create);
router.get('/farmers/:id', manage, validate({ params: idParams }), farmers.show);
router.patch('/farmers/:id', manage, validate({ params: idParams, body: farmerUpdateSchema }), farmers.update);
router.post('/farmers/:id/remove', manage, validate({ params: idParams, body: reasonSchema }), farmers.remove);
router.post('/farmers/:id/approve', decide, validate({ params: idParams }), farmers.approve);
router.post('/farmers/:id/reject', decide, validate({ params: idParams, body: reasonSchema }), farmers.reject);
router.post('/farmers/:id/transfer/approve', decide, validate({ params: idParams }), farmers.approveTransfer);
router.post('/farmers/:id/transfer/reject', decide, validate({ params: idParams, body: reasonSchema }), farmers.rejectTransfer);

export default router;
