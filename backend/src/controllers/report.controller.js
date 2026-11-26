import * as reports from '../services/report.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await reports.getReport(req.user, req.params.section, req.query) });
});

export const exportCsv = asyncHandler(async (req, res) => {
  const { filename, csv } = await reports.exportReport(req.user, req.query);
  res.attachment(filename).type('text/csv; charset=utf-8').send(csv);
});
