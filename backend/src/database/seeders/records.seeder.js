import { findFarmIdsInScope } from '../../repositories/farm.repository.js';
import { insertHarvests } from '../../repositories/harvest.repository.js';
import { findUsersByUsernames } from '../../repositories/user.repository.js';
import { loadScope } from '../../services/auth.service.js';
import { archiveFarm, createFarm, setAssignedFarmers } from '../../services/farm.service.js';
import { labelPoint } from '../../services/boundary.service.js';
import { isValidBarangay } from '../../services/location.service.js';
import { createTreeGroup } from '../../services/treeGroup.service.js';

const DAY = 86_400_000;
/** Manila calendar day `days` ago, as the API takes it. */
const dayAgo = (days) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date(Date.now() - days * DAY));

/**
 * Farms in all 6 towns (PHASE-2-SPEC §8). `by` adds the farm (its owner, a Group Manager for its farmer, or Kaluppa);
 * `trees`: [variety, stage, count, years since planting, note?].
 */
const FARMS = [
  { by: 'farmer.approved', sizeHa: 1.2, municipality: 'Santa Cruz', barangay: 'Pantayin', street: 'Sitio Ilaya',
    trees: [['liberica', 'fruiting', 120, 6, 'Shade-grown under coconut'], ['excelsa', 'fruiting', 80, 5], ['liberica', 'newly_planted', 40, 0]] },
  { by: 'farmer.approved', sizeHa: 0.6, municipality: 'Mogpog', barangay: 'Bocboc', street: 'Purok 2',
    trees: [['excelsa', 'flowering', 150, 4], ['excelsa', 'damaged', 30, 7, 'Leaf rust after the October rains']] },
  { by: 'manager.santacruz', farmer: 'nestor.perez', sizeHa: 2.1, municipality: 'Santa Cruz', barangay: 'Lipa', street: 'Sitio Bato',
    trees: [['robusta', 'fruiting', 300, 8], ['liberica', 'growing', 180, 2], ['excelsa', 'fruiting', 130, 6]] },
  { by: 'lorna.ilagan', sizeHa: 0.5, municipality: 'Santa Cruz', barangay: 'Napo', trees: [['liberica', 'fruiting', 90, 5]] },
  { by: 'felix.rey', sizeHa: 1.0, municipality: 'Boac', barangay: 'Tumagabok',
    trees: [['arabica', 'fruiting', 180, 6], ['robusta', 'growing', 120, 2]] },
  { by: 'farmer.transfer', sizeHa: 0.9, municipality: 'Boac', barangay: 'Mainit', trees: [['robusta', 'fruiting', 260, 9]] },
  { by: 'tomas.leano', sizeHa: 0.7, municipality: 'Gasan', barangay: 'Bahi', trees: [['liberica', 'fruiting', 200, 7]] },
  { by: 'farmer.new', sizeHa: 1.6, municipality: 'Buenavista', barangay: 'Sihi',
    trees: [['excelsa', 'fruiting', 260, 6], ['liberica', 'flowering', 160, 3]] },
  { by: 'kaluppa', managedBy: 'manager.santacruz', workers: ['nestor.perez', 'lorna.ilagan', 'marlon.sevilla'],
    sizeHa: 3.5, municipality: 'Santa Cruz', barangay: 'Pantayin', street: 'Kaluppa compound',
    trees: [['liberica', 'fruiting', 600, 8], ['excelsa', 'fruiting', 350, 6], ['arabica', 'growing', 200, 2], ['liberica', 'newly_planted', 100, 0, 'Seedlings from the Kaluppa nursery']] },
  { by: 'kaluppa', sizeHa: 1.4, municipality: 'Torrijos', barangay: 'Bonliw',
    trees: [['robusta', 'newly_planted', 500, 0], ['liberica', 'growing', 300, 1]] },
  { by: 'farmer.approved', sizeHa: 0.3, municipality: 'Santa Cruz', barangay: 'Botilao', archive: true,
    trees: [['liberica', 'damaged', 20, 10, 'Old trees, replanted elsewhere']] },
];
// Harvest season peaks November to February; the other months bring small pickings.
const SEASON = [1.3, 1.2, 0.8, 0.5, 0.35, 0.3, 0.3, 0.35, 0.5, 0.8, 1.2, 1.4];

/** Kilograms for a farm's monthly picking: grows with its fruiting trees and the season, in 0.5 kg steps. */
function harvestKg(fruitingTrees, monthIndex, salt) {
  const kg = (fruitingTrees / 2) * SEASON[monthIndex] * (0.85 + ((salt * 37) % 30) / 100);
  return Math.max(0.5, Math.round(kg * 2) / 2);
}

async function actors(handles) {
  const users = await findUsersByUsernames([...new Set(handles)]);
  const out = {};
  for (const u of users) out[u.username] = await loadScope(u);
  return out;
}

/**
 * Records (PHASE-2-SPEC §8): farms in every town with pins, two Kaluppa farms (one managed by manager.santacruz, with
 * workers), tree groups in all five stages and a year of monthly harvests. Farms and trees go through the services so
 * property numbers, scope and audit entries match real use; the ~110 harvests are one bulk write (no audit entries),
 * each from a variety with fruiting trees on its farm, as the API requires. Runs once: skipped when any farm exists.
 */
export async function seedRecords() {
  if ((await findFarmIdsInScope({})).length) return 'already seeded';
  const handles = FARMS.flatMap((f) => [f.by, f.farmer, f.managedBy, ...(f.workers ?? [])]).filter(Boolean);
  const people = await actors(handles);
  let groups = 0;
  const harvests = [];
  for (const [i, f] of FARMS.entries()) {
    if (!isValidBarangay(f.municipality, f.barangay)) throw new Error(`Seed farm ${i}: ${f.barangay} isn't in ${f.municipality}`);
    const actor = people[f.by];
    const farm = await createFarm(actor, {
      sizeHa: f.sizeHa, municipality: f.municipality, barangay: f.barangay, street: f.street ?? '',
      location: labelPoint(f.municipality, f.barangay), // inside its barangay, so the map highlight matches
      ...(f.farmer && { farmerId: people[f.farmer]._id }),
      ...(f.by === 'kaluppa' && { managedById: f.managedBy ? people[f.managedBy]._id : null }),
    });
    const recorder = f.managedBy ? people[f.managedBy] : actor;
    if (f.workers) await setAssignedFarmers(recorder, farm.id, { farmerIds: f.workers.map((w) => people[w]._id) });
    for (const [variety, stage, count, years, note = ''] of f.trees) {
      await createTreeGroup(recorder, { farmId: farm.id, variety, stage, count, plantedAt: dayAgo(years * 365 + 40 + i * 9), note });
      groups++;
    }
    // A year of monthly pickings from the varieties with fruiting trees.
    const fruiting = f.trees.filter(([, stage]) => stage === 'fruiting');
    for (let month = 0; month < 12 && fruiting.length; month++) {
      const daysAgo = month * 30 + 3 + (i % 5) * 2;
      const [variety, , trees] = fruiting[month % fruiting.length];
      const monthIndex = Number(dayAgo(daysAgo).slice(5, 7)) - 1;
      const by = f.by === 'kaluppa' && f.managedBy && month % 2 ? people[f.by] : recorder;
      harvests.push({
        farm: farm.id, owner: farm.owner.id, association: farm.association?.id ?? null, recordedBy: by._id,
        variety, yieldKg: harvestKg(trees, monthIndex, i + month), harvestedAt: dayAgo(daysAgo),
        note: month === 0 ? 'Red cherries only, dried on raised beds' : '',
      });
    }
    if (f.archive) await archiveFarm(actor, farm.id);
  }
  await insertHarvests(harvests);
  return `${FARMS.length} farms, ${groups} tree groups, ${harvests.length} harvests`;
}
