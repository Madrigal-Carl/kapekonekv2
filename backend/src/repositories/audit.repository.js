import { AuditLog } from '../models/auditLog.model.js';

/** @param {object} entry an AuditLog document */
export const insertAuditEntry = (entry) => AuditLog.create(entry);
