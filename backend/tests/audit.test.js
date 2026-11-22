import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startMemoryDb, stopMemoryDb } from './helpers/db.js';

const { record } = await import('../src/services/audit.service.js');
const { AuditLog } = await import('../src/models/index.js');

beforeAll(startMemoryDb);
afterAll(stopMemoryDb);
beforeEach(() => AuditLog.deleteMany({}));

const manager = { _id: new mongoose.Types.ObjectId(), roles: ['group_manager'] };
const farmerId = new mongoose.Types.ObjectId();

describe('audit.record', () => {
  it('stores only the listed fields that changed, with before and after', async () => {
    await record({
      actor: manager,
      area: 'farmers',
      action: 'update',
      entity: { type: 'farmer', id: farmerId, label: 'Pedro Reyes' },
      before: { contactNumber: '09170000000', municipality: 'Boac', password: 'old', notes: 'x' },
      after: { contactNumber: '09171111111', municipality: 'Boac', password: 'new', notes: 'y' },
      fields: ['contactNumber', 'municipality', 'password', 'documents'],
    });
    const [entry] = await AuditLog.find().lean();
    expect(entry).toMatchObject({
      actor: manager._id, actorRole: 'group_manager', area: 'farmers', action: 'update',
      entityType: 'farmer', entityId: farmerId, entityLabel: 'Pedro Reyes',
      changes: [{ field: 'contactNumber', from: '09170000000', to: '09171111111' }],
    });
    expect(entry.at).toBeInstanceOf(Date);
  });

  it('never stores passwords or documents, even on create', async () => {
    await record({
      actor: manager, area: 'farmers', action: 'create', entity: { type: 'farmer', id: farmerId, label: 'Nora' },
      after: { username: 'nora', password: 'Temp@1234', documents: [{ url: 'x' }], receipt: { url: 'r' } },
      fields: ['username', 'password', 'documents', 'receipt'],
    });
    const [entry] = await AuditLog.find().lean();
    expect(entry.changes).toEqual([{ field: 'username', from: null, to: 'nora' }]);
  });

  it('records the system as the actor when there is none', async () => {
    await record({ actor: null, area: 'beans', action: 'expire', entity: { type: 'bean_listing', id: farmerId, label: 'BN-2611-0001' } });
    const [entry] = await AuditLog.find().lean();
    expect(entry).toMatchObject({ actor: null, actorRole: 'system', changes: [] });
  });
});
