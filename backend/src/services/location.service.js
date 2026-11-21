import { createRequire } from 'node:module';
import { POSTAL_CODES } from '../data/postal-codes.js';

const data = createRequire(import.meta.url)('../data/marinduque-locations.json');

const LOCATIONS = Object.entries(POSTAL_CODES).map(([name, postalCode]) => ({
  name,
  postalCode,
  barangays: data.municipalities.find((m) => m.name === name).barangays,
}));

/** @returns {Array<{ name: string, postalCode: string, barangays: string[] }>} the 6 Marinduque municipalities */
export const getLocations = () => LOCATIONS;

/** Does `barangay` belong to `municipality`? Both must match the list exactly. */
export const isValidBarangay = (municipality, barangay) =>
  LOCATIONS.some((m) => m.name === municipality && m.barangays.includes(barangay));
