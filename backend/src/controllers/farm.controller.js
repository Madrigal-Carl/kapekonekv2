import * as farms from '../services/farm.service.js';
import { mapFarms } from '../services/farmMap.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await farms.listFarms(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await farms.getFarm(req.user, req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  const farm = await farms.createFarm(req.user, req.body);
  sendSuccess(res, { status: 201, message: `Farm saved as ${farm.propertyNumber}.`, data: farm });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Farm updated.', data: await farms.updateFarm(req.user, req.params.id, req.body) });
});

export const archive = asyncHandler(async (req, res) => {
  const farm = await farms.archiveFarm(req.user, req.params.id);
  sendSuccess(res, { message: `${farm.propertyNumber} was archived.`, data: farm });
});

export const restore = asyncHandler(async (req, res) => {
  const farm = await farms.restoreFarm(req.user, req.params.id);
  sendSuccess(res, { message: `${farm.propertyNumber} was restored.`, data: farm });
});

export const assignFarmers = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Farmers updated.', data: await farms.setAssignedFarmers(req.user, req.params.id, req.body) });
});

export const map = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await mapFarms(req.user, req.query) });
});
