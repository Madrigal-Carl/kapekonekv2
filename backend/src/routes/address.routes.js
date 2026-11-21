import { Router } from 'express';
import * as addresses from '../controllers/address.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { addressSchema } from '../schemas/address.schema.js';
import { idParams } from '../schemas/common.schema.js';

const router = Router();
router.use('/addresses', authenticate, verified, can('addresses.manage'));

router.get('/addresses', addresses.list);
router.post('/addresses', validate({ body: addressSchema }), addresses.create);
router.patch('/addresses/:id', validate({ params: idParams, body: addressSchema }), addresses.update);
router.delete('/addresses/:id', validate({ params: idParams }), addresses.remove);
router.post('/addresses/:id/default', validate({ params: idParams }), addresses.makeDefault);

export default router;
