import * as auditLogs from '../services/auditLog.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendFile, sendSuccess } from '../utils/response.js';

export const entityHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await auditLogs.getEntityHistory(req.user, { ...req.params, ...req.query });
  sendSuccess(res, { data: items, meta });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await auditLogs.listAuditLog(req.query);
  sendSuccess(res, { data: items, meta });
});

export const show = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await auditLogs.getAuditEntry(req.params.id) });
});

export const exportFile = asyncHandler(async (req, res) => {
  sendFile(res, await auditLogs.exportAuditLog(req.user, req.query));
});
