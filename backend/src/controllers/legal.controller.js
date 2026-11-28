import * as authService from '../services/auth.service.js';
import * as legal from '../services/legal.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const current = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await legal.getCurrentLegal() });
});

/** Agree, then answer with the fresh session (mustAcceptTerms is now false). */
export const accept = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Thanks for agreeing.', data: await authService.acceptTermsAndRefresh(req.user, req.body.version) });
});
