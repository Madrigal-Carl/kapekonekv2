import * as associations from '../services/association.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await associations.listAssociations(req.query);
  sendSuccess(res, { data: items, meta });
});

export const options = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await associations.associationOptions() });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await associations.getAssociation(req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Association added.', data: await associations.createAssociation(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Association updated.', data: await associations.updateAssociation(req.user, req.params.id, req.body) });
});

export const archive = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Association archived.', data: await associations.archiveAssociation(req.user, req.params.id) });
});

export const restore = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Association restored.', data: await associations.restoreAssociation(req.user, req.params.id) });
});
