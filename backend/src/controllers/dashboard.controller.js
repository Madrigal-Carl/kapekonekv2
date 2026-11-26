import * as dashboard from '../services/dashboard.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const badges = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dashboard.badgesFor(req.user) });
});

export const org = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dashboard.orgCardFor(req.user) });
});

export const overview = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await dashboard.overviewFor(req.user, req.query) });
});
