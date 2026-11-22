import * as authService from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies.js';
import { sendSuccess } from '../utils/response.js';

export const register = asyncHandler(async (req, res) => {
  const { user, session } = await authService.register(req.body);
  setAuthCookies(res, user, { remember: false });
  sendSuccess(res, { status: 201, message: 'Account created. Check your email to verify it.', data: session });
});

export const login = asyncHandler(async (req, res) => {
  const { user, remember, session } = await authService.login(req.body);
  setAuthCookies(res, user, { remember });
  sendSuccess(res, { message: 'Signed in.', data: session });
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const { user, remember, session } = await authService.refresh(req.cookies?.refreshToken);
    setAuthCookies(res, user, { remember });
    sendSuccess(res, { data: session });
  } catch (error) {
    clearAuthCookies(res);
    throw error;
  }
});

export const logout = (_req, res) => {
  clearAuthCookies(res);
  sendSuccess(res, { message: 'Signed out.' });
};

export const firstPassword = asyncHandler(async (req, res) => {
  const { user, session } = await authService.setFirstPasswordFor(req.user, req.body);
  setAuthCookies(res, user, { remember: false });
  sendSuccess(res, { message: 'Password set.', data: session });
});

export const me = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await authService.buildSession(req.user) });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  await authService.verifyEmail(req.body);
  sendSuccess(res, { message: 'Your email is verified.' });
});

export const resendVerification = asyncHandler(async (req, res) => {
  await authService.resendVerification(req.user);
  sendSuccess(res, { message: 'A new verification link has been sent.' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.forgotPassword(req.body);
  sendSuccess(res, { message: 'If an account uses that email, a reset link is on its way.' });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body);
  clearAuthCookies(res);
  sendSuccess(res, { message: 'Your password was reset. Sign in with your new password.' });
});

export const usernameAvailability = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await authService.usernameAvailability(req.query) });
});

export const usernameSuggestions = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await authService.usernameSuggestions(req.query) });
});
