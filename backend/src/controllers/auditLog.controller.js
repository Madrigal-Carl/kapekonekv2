import * as auditLogs from '../services/auditLog.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/response.js';

export const entityHistory = asyncHandler(async (req, res) => {
  const { items, meta } = await auditLogs.getEntityHistory(req.user, { ...req.params, ...req.query });
  sendSuccess(res, { data: items, meta });
});
