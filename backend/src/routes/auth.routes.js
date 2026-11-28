import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate, guestOnly } from '../middlewares/auth.middleware.js';
import { rateLimit } from '../middlewares/rateLimit.middleware.js';
import { validate } from '../middlewares/validate.js';
import {
  firstPasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  suggestionsQuerySchema,
  tokenSchema,
  usernameQuerySchema,
  addEmailSchema,
} from '../schemas/auth.schema.js';

const router = Router();

const loginLimit = rateLimit({
  name: 'login',
  limit: 5,
  windowSec: 60,
  key: (req) => `${req.ip}:${String(req.body?.identifier ?? '').trim().toLowerCase()}`,
  message: 'Too many sign-in attempts. Please wait a minute and try again.',
});
const usernameLimit = rateLimit({ name: 'username', limit: 30, windowSec: 60 });
const resendLimit = rateLimit({
  name: 'verify-resend',
  limit: 1,
  windowSec: 60,
  key: (req) => String(req.user._id),
  message: 'Please wait a minute before asking for another link.',
});
const forgotLimit = rateLimit({ name: 'forgot-password', limit: 5, windowSec: 15 * 60 });
const addEmailLimit = rateLimit({ name: 'add-email', limit: 5, windowSec: 10 * 60, key: (req) => String(req.user._id) });

router.post('/register', guestOnly, validate({ body: registerSchema }), auth.register);
router.post('/login', guestOnly, loginLimit, validate({ body: loginSchema }), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', authenticate, auth.logout);
router.get('/me', authenticate, auth.me);
router.patch('/password/first', authenticate, validate({ body: firstPasswordSchema }), auth.firstPassword);

router.get('/username-availability', usernameLimit, validate({ query: usernameQuerySchema }), auth.usernameAvailability);
router.get('/username-suggestions', usernameLimit, validate({ query: suggestionsQuerySchema }), auth.usernameSuggestions);

router.post('/email/verify', validate({ body: tokenSchema }), auth.verifyEmail);
router.post('/email/verification-notification', authenticate, resendLimit, auth.resendVerification);
router.post('/email', authenticate, addEmailLimit, validate({ body: addEmailSchema }), auth.addEmail); // username-only accounts: "Add your email"

router.post('/forgot-password', forgotLimit, validate({ body: forgotPasswordSchema }), auth.forgotPassword);
router.post('/reset-password', validate({ body: resetPasswordSchema }), auth.resetPassword);

export default router;
