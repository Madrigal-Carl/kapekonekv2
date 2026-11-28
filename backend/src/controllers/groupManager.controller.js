import * as groupManagers from '../services/groupManager.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await groupManagers.listGroupManagers(req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await groupManagers.getGroupManager(req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Group Manager added. We emailed them a link to verify their email.', data: await groupManagers.createGroupManager(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Group Manager updated.', data: await groupManagers.updateGroupManager(req.user, req.params.id, req.body) });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await groupManagers.resetGroupManagerPassword(req.user, req.params.id);
  sendSuccess(res, { message: 'Password reset. They were signed out everywhere and we emailed them.' });
});

export const archive = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Group Manager archived.', data: await groupManagers.archiveGroupManager(req.user, req.params.id) });
});

export const restore = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Group Manager restored.', data: await groupManagers.restoreGroupManager(req.user, req.params.id) });
});
