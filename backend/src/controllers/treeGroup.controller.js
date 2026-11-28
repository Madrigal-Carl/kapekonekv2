import * as treeGroups from '../services/treeGroup.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await treeGroups.listTreeGroups(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Tree group saved.', data: await treeGroups.createTreeGroup(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Tree group updated.', data: await treeGroups.updateTreeGroup(req.user, req.params.id, req.body) });
});

export const archive = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Tree group archived.', data: await treeGroups.archiveTreeGroup(req.user, req.params.id) });
});

export const restore = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Tree group restored.', data: await treeGroups.restoreTreeGroup(req.user, req.params.id) });
});
