import * as settings from '../services/adminSetting.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

const SAVED = 'Settings saved. New quotes use the updated values.';

export const branch = asyncHandler(async (_req, res) => sendSuccess(res, { data: await settings.getBranchSetting() }));
export const saveBranch = asyncHandler(async (req, res) => sendSuccess(res, { message: SAVED, data: await settings.saveBranchSetting(req.user, req.body) }));
export const delivery = asyncHandler(async (_req, res) => sendSuccess(res, { data: await settings.getDeliverySetting() }));
export const saveDelivery = asyncHandler(async (req, res) => sendSuccess(res, { message: SAVED, data: await settings.saveDeliverySetting(req.user, req.body) }));
export const ewallet = asyncHandler(async (_req, res) => sendSuccess(res, { data: await settings.getEwalletSetting() }));
export const saveEwallet = asyncHandler(async (req, res) => sendSuccess(res, { message: SAVED, data: await settings.saveEwalletSetting(req.user, req.body) }));
