import * as farmers from '../services/farmer.service.js';
import * as myProfile from '../services/farmerProfile.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

// The farmer's own association state.
export const showMine = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await myProfile.getMyProfile(req.user) });
});

export const requestToJoin = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Request sent. We’ll let you know once it’s reviewed.', data: await myProfile.requestToJoin(req.user, req.body) });
});

export const requestTransfer = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Transfer requested.', data: await myProfile.requestTransfer(req.user, req.body) });
});

export const withdrawTransfer = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Transfer request withdrawn.', data: await myProfile.withdrawTransfer(req.user) });
});

// Group Managers (own association) and Kaluppa.
export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await farmers.listFarmers(req.user, req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await farmers.getFarmer(req.user, req.params.id) });
});

export const create = asyncHandler(async (req, res) => {
  sendSuccess(res, { status: 201, message: 'Farmer added.', data: await farmers.createFarmer(req.user, req.body) });
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Farmer updated.', data: await farmers.updateFarmer(req.user, req.params.id, req.body) });
});

export const approve = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Farmer approved.', data: await farmers.approveFarmer(req.user, req.params.id) });
});

export const reject = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Request rejected.', data: await farmers.rejectFarmer(req.user, req.params.id, req.body) });
});

export const approveTransfer = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Transfer approved.', data: await farmers.approveTransfer(req.user, req.params.id) });
});

export const rejectTransfer = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Transfer rejected.', data: await farmers.rejectTransfer(req.user, req.params.id, req.body) });
});

export const remove = asyncHandler(async (req, res) => {
  sendSuccess(res, { message: 'Farmer removed from the association.', data: await farmers.removeFarmer(req.user, req.params.id, req.body) });
});
