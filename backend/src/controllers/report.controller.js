import * as reports from '../services/report.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendFile, sendSuccess } from '../utils/response.js';

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reports.getReport(req.user, req.params.section, req.query) });
});

export const exportFile = asyncHandler(async (req, res) => {
  sendFile(res, await reports.exportReport(req.user, req.query));
});
