import { Router } from 'express';
import * as orders from '../controllers/order.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { idParams } from '../schemas/common.schema.js';
import { orderListQuery, placeOrderSchema } from '../schemas/order.schema.js';

const router = Router();
router.use('/orders', authenticate, verified);

router.post('/orders', can('orders.create'), validate({ body: placeOrderSchema }), orders.place);
router.get('/orders', can('orders.view_own'), validate({ query: orderListQuery }), orders.list);
router.get('/orders/counts', can('orders.view_own'), orders.counts);
router.get('/orders/:id', can('orders.view_own'), validate({ params: idParams }), orders.show);

export default router;
