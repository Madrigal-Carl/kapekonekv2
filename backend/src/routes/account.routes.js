import { Router } from 'express';
import * as account from '../controllers/account.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { can } from '../middlewares/permission.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.js';
import { verified } from '../middlewares/verified.middleware.js';
import { avatarSchema, changeEmailSchema, changePasswordSchema, profileSchema } from '../schemas/account.schema.js';

const router = Router();
router.use('/account', authenticate, verified, can('profile.update'));

// Both forms check the current password, so cap the guesses per user.
const passwordCheckLimit = rateLimit({
  name: 'account-password',
  limit: 5,
  windowSec: 60,
  key: (req) => String(req.user._id),
  message: 'Too many attempts. Please wait a minute and try again.',
});

router.get('/account/profile', account.showProfile);
router.patch('/account/profile', validate({ body: profileSchema }), account.updateProfile);
router.patch('/account/avatar', validate({ body: avatarSchema }), account.setAvatar);
router.delete('/account/avatar', account.removeAvatar);
router.patch('/account/email', passwordCheckLimit, validate({ body: changeEmailSchema }), account.changeEmail);
router.patch('/account/password', passwordCheckLimit, validate({ body: changePasswordSchema }), account.changePassword);

export default router;
