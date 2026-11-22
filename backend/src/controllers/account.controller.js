import * as account from '../services/account.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { setAuthCookies } from '../utils/cookies.js';
import { sendSuccess } from '../utils/response.js';

export const showProfile = (req, res) => sendSuccess(res, { data: account.getProfile(req.user) });

export const updateProfile = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Your profile is saved.', data: await account.updateProfile(req.user, req.body) });
});

export const setAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Your photo is updated.', data: await account.setAvatar(req.user, req.body) });
});

export const removeAvatar = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Your photo was removed.', data: await account.removeAvatar(req.user) });
});

export const changeEmail = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Check your new email for a verification link.', data: await account.changeEmail(req.user, req.body) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { user, remember, session } = await account.changePassword(req.user, req.body, req.cookies?.refreshToken);
  setAuthCookies(res, user, { remember });
  sendSuccess(res, { message: 'Your password is changed. Your other devices were signed out.', data: session });
});
