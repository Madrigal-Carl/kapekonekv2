import { Router } from 'express';
import * as beans from '../controllers/bean.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can, canAny } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { beanCancelSchema, beanCapQuery, beanCompleteSchema, beanListQuery, beanRejectSchema, beanSchema } from '../schemas/bean.schema.js';
import { idParams } from '../schemas/common.schema.js';

const router = Router();
const sellOrReview = canAny('beans.sell', 'beans.review');

// Scope (whose listing) is decided in bean.service by policy (PHASE-2-SPEC §2, §3.5).
router.use('/beans', authenticate, verified);
router.get('/beans', sellOrReview, validate({ query: beanListQuery }), beans.list);
router.post('/beans', can('beans.sell'), validate({ body: beanSchema }), beans.create);
router.get('/beans/cap', sellOrReview, validate({ query: beanCapQuery }), beans.cap);
router.get('/beans/:id', sellOrReview, validate({ params: idParams }), beans.show);
router.patch('/beans/:id', can('beans.sell'), validate({ params: idParams, body: beanSchema }), beans.update);
router.post('/beans/:id/approve', can('beans.review'), validate({ params: idParams }), beans.approve);
router.post('/beans/:id/reject', can('beans.review'), validate({ params: idParams, body: beanRejectSchema }), beans.reject);
router.post('/beans/:id/complete', can('beans.review'), validate({ params: idParams, body: beanCompleteSchema }), beans.complete);
router.post('/beans/:id/cancel', sellOrReview, validate({ params: idParams, body: beanCancelSchema }), beans.cancel);

export default router;
