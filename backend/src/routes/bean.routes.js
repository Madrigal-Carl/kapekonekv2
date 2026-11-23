import { Router } from 'express';
import * as beans from '../controllers/bean.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can, canAny } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { beanCapQuery, beanListQuery, beanSchema } from '../schemas/bean.schema.js';
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

export default router;
