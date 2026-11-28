import { listMapFarms } from '../repositories/farm.repository.js';
import { lastByFarms } from '../repositories/harvest.repository.js';
import { farmIdsWithVariety, treeMixByFarms } from '../repositories/treeGroup.repository.js';
import { person, scopeOf } from './farm.service.js';
import { isKaluppaFarm, seesEveryAssociation } from './policy.service.js';
import { getSetting } from './setting.service.js';

/** Largest first; ties by name so the popover reads the same each time. */
const ranked = (counts, key) =>
  [...counts].map(([name, count]) => ({ [key]: name, count })).sort((x, y) => y.count - x.count || x[key].localeCompare(y[key]));

/** Per farm: trees by variety and by stage. */
function mixOf(rows) {
  const farms = new Map();
  for (const { _id, trees } of rows) {
    const id = String(_id.farm);
    if (!farms.has(id)) farms.set(id, { varieties: new Map(), stages: new Map(), total: 0 });
    const f = farms.get(id);
    f.varieties.set(_id.variety, (f.varieties.get(_id.variety) ?? 0) + trees);
    f.stages.set(_id.stage, (f.stages.get(_id.stage) ?? 0) + trees);
    f.total += trees;
  }
  return farms;
}

/**
 * The Farm Map (PHASE-2-SPEC §3.11): one pin per active farm in the actor's scope (farmer: own; Group Manager: its
 * association's farms + the Kaluppa farm it manages; Kaluppa: all), with the popover fields, plus the branch pin.
 * The association filter is Kaluppa's only; a Group Manager's scope already is its association.
 * @param {object} actor
 * @param {{ association?: string, municipality?: string, variety?: string }} filters
 */
export async function mapFarms(actor, { association, municipality, variety }) {
  const farms = await listMapFarms(scopeOf(actor), {
    association: seesEveryAssociation(actor) ? association : undefined,
    municipality,
    farmIds: variety ? await farmIdsWithVariety(variety) : undefined,
  });
  const ids = farms.map((f) => f._id);
  const [mix, last, branch] = await Promise.all([treeMixByFarms(ids).then(mixOf), lastByFarms(ids), getSetting('branch')]);
  return {
    branch: { name: branch.name, location: branch.location },
    farms: farms.map((farm) => {
      const m = mix.get(String(farm._id));
      const [lng, lat] = farm.location.coordinates;
      const harvest = last.get(String(farm._id));
      return {
        id: String(farm._id),
        propertyNumber: farm.propertyNumber,
        ownerType: farm.ownerType,
        owner: person(farm.owner),
        association: farm.association ? { id: String(farm.association._id), name: farm.association.name } : null,
        managedBy: isKaluppaFarm(farm) ? person(farm.managedBy) : null,
        sizeHa: farm.sizeHa,
        municipality: farm.municipality,
        barangay: farm.barangay,
        location: { lat, lng },
        treeCount: m?.total ?? 0,
        varieties: m ? ranked(m.varieties, 'variety') : [],
        // "The main stages": the two largest, as shares of the farm's trees.
        stages: m ? ranked(m.stages, 'stage').slice(0, 2).map((s) => ({ stage: s.stage, pct: Math.round((s.count / m.total) * 100) })) : [],
        lastHarvest: harvest ? { yieldKg: harvest.yieldKg, harvestedAt: harvest.harvestedAt.toISOString().slice(0, 10) } : null,
      };
    }),
  };
}
