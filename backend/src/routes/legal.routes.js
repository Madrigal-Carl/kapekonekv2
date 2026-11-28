import { Router } from 'express';
import { z } from 'zod';
import * as legal from '../controllers/legal.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.js';

// Terms and Conditions (Change 09). Both stay open to a user who hasn't agreed yet (see TERMS_FREE in auth.middleware).
const acceptSchema = z.object({ version: z.number('Agree to the current version').int().positive() });

const router = Router();
router.get('/legal/current', legal.current);
router.post('/legal/accept', authenticate, validate({ body: acceptSchema }), legal.accept);

export default router;
