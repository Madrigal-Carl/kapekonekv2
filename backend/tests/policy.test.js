import { describe, expect, it } from 'vitest';
import { isAssignedManager, isAssociationManager, isKaluppaFarm, isOwner, seesEveryAssociation } from '../src/services/policy.service.js';

const id = (n) => `64b000000000000000000${String(n).padStart(3, '0')}`;
const farmer = { _id: id(1), roles: ['farmer'] };
const otherFarmer = { _id: id(2), roles: ['farmer'] };
const manager = { _id: id(3), roles: ['group_manager'], associationId: id(100) };
const otherManager = { _id: id(4), roles: ['group_manager'], associationId: id(101) };
const unassignedManager = { _id: id(5), roles: ['group_manager'], associationId: null };

const farmerFarm = { owner: id(1), ownerType: 'farmer', association: id(100), managedBy: null };
const kaluppaFarm = { owner: id(9), ownerType: 'kaluppa', association: null, managedBy: id(3) };

describe('policy helpers', () => {
  it('isOwner: the owner (or the listing farmer) only', () => {
    expect(isOwner(farmer, farmerFarm)).toBe(true);
    expect(isOwner(otherFarmer, farmerFarm)).toBe(false);
    expect(isOwner(farmer, { farmer: id(1) })).toBe(true);
    expect(isOwner(farmer, { owner: null })).toBe(false);
  });

  it('isAssociationManager: the Group Manager of that association only', () => {
    expect(isAssociationManager(manager, id(100))).toBe(true);
    expect(isAssociationManager(otherManager, id(100))).toBe(false);
    expect(isAssociationManager(unassignedManager, id(100))).toBe(false);
    expect(isAssociationManager(unassignedManager, null)).toBe(false);
    expect(isAssociationManager({ ...farmer, associationId: id(100) }, id(100))).toBe(false);
  });

  it('isKaluppaFarm: by owner type', () => {
    expect(isKaluppaFarm(kaluppaFarm)).toBe(true);
    expect(isKaluppaFarm(farmerFarm)).toBe(false);
  });

  it('isAssignedManager: the Group Manager a Kaluppa farm is assigned to', () => {
    expect(isAssignedManager(manager, kaluppaFarm)).toBe(true);
    expect(isAssignedManager(otherManager, kaluppaFarm)).toBe(false);
    expect(isAssignedManager(manager, { ...farmerFarm, managedBy: id(3) })).toBe(false); // only Kaluppa farms have managers
  });
});

describe('seesEveryAssociation', () => {
  it('is true for Kaluppa only', () => {
    expect(seesEveryAssociation({ roles: ['kaluppa'] })).toBe(true);
    expect(seesEveryAssociation({ roles: ['group_manager'] })).toBe(false);
  });
});
