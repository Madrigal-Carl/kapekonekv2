import * as harvests from '../services/harvest.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await harvests.listHarvests(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Harvest saved.', data: await harvests.createHarvest(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Harvest updated.', data: await harvests.updateHarvest(req.user, req.params.id, req.body) });
});

export const archive = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Harvest archived.', data: await harvests.archiveHarvest(req.user, req.params.id) });
});

export const restore = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Harvest restored.', data: await harvests.restoreHarvest(req.user, req.params.id) });
});
