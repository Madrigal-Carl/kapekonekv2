import { registerFarmer, setUpAssociations, signedIn } from './farmers.js';

export const SANTA_CRUZ = { lat: 13.4778, lng: 122.03 };
export const BOAC = { lat: 13.4467, lng: 121.8406 };
export const farmBody = (fields = {}) => ({ lotNumber: 'Lot 1', sizeHa: 1.2, municipality: 'Santa Cruz', barangay: 'Pantayin', street: '', location: SANTA_CRUZ, ...fields });

/** Manila "YYYY-MM-DD", `days` from today. */
export const dayKey = (days = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() + days * 86_400_000));

/**
 * Records in every scope (PHASE-2-SPEC §2): Ana (Santa Cruz) with a farm, Ben (Boac) with a farm,
 * a Kaluppa farm managed by manager.santacruz and an unassigned one.
 */
export async function setUpRecords(app, { User, FarmerProfile }) {
  const a = await setUpAssociations(app, User);
  const manager = await signedIn(app, 'manager.santacruz');
  const boacManager = await signedIn(app, 'manager.unassigned');
  const farmer = async (username, association) => {
    const f = await registerFarmer(app, User, username);
    await FarmerProfile.updateOne({ user: f.user._id }, { status: 'approved', association: association.id, approvedAt: new Date() });
    return f;
  };
  const ana = await farmer('ana', a.santacruz);
  const ben = await farmer('ben', a.boac);
  const add = async (agent, body) => (await agent.post('/api/farms').send(farmBody(body)).expect(201)).body.data;
  const managerId = String((await User.findOne({ username: 'manager.santacruz' }))._id);
  const farms = {
    ana: await add(ana.agent, { lotNumber: 'Ana 1' }),
    ana2: await add(ana.agent, { lotNumber: 'Ana 2', barangay: 'Matalaba' }),
    ben: await add(ben.agent, { lotNumber: 'Ben 1', municipality: 'Boac', barangay: 'Tumagabok', location: BOAC }),
    kalManaged: await add(a.kaluppa, { lotNumber: 'Kaluppa Demo Farm', managedById: managerId }),
    kalOpen: await add(a.kaluppa, { lotNumber: 'Torrijos Nursery', municipality: 'Torrijos', barangay: 'Bonliw', location: { lat: 13.3189, lng: 122.0819 } }),
  };
  return { a, kaluppa: a.kaluppa, manager, boacManager, ana, ben, farms };
}
