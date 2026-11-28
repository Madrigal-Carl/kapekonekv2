import { countActiveByUser, insertAddresses, syncAddressCounts } from '../../repositories/address.repository.js';
import { findUsersByUsernames } from '../../repositories/user.repository.js';
import { labelPoint } from '../../services/boundary.service.js';
import { getLocations } from '../../services/location.service.js';

const point = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

/** Juana's three addresses (PRODUCT-SPEC §11). */
const JUANA = [
  { label: 'Home', recipientName: 'Juana Dela Cruz', phone: '09171234567', municipality: 'Mogpog', barangay: 'Balanacan', street: 'Lot 12, Purok 3, near the chapel', location: point(13.527, 121.87), isDefault: true },
  { label: 'Work', recipientName: 'Juana Dela Cruz', phone: '09171234567', municipality: 'Santa Cruz', barangay: 'Banahaw Poblacion', street: 'Municipal Hall, ground floor', location: point(13.476, 122.028) },
  { label: 'Other', customLabel: 'Mama’s house', recipientName: 'Lourdes Dela Cruz', phone: '09987654321', municipality: 'Boac', barangay: 'Caganhao', street: 'Blue gate beside the sari-sari store' },
];

/** Rodel's addresses (FarmerAddresses.dc.html): a pinned Farm and Home, and an unpinned one. */
const pinAt = (municipality, barangay) => {
  const { lat, lng } = labelPoint(municipality, barangay);
  return point(lat, lng);
};
const RODEL = [
  { label: 'Farm', recipientName: 'Rodel Mendoza', phone: '09172221043', municipality: 'Santa Cruz', barangay: 'Pantayin', street: 'Sitio Ilaya, beside the chapel', location: pinAt('Santa Cruz', 'Pantayin'), isDefault: true },
  { label: 'Home', recipientName: 'Rodel Mendoza', phone: '09172221043', municipality: 'Mogpog', barangay: 'Bocboc', street: 'Purok 2, near the elementary school', location: pinAt('Mogpog', 'Bocboc') },
  { label: 'Other', customLabel: 'Mama’s house', recipientName: 'Lourdes Mendoza', phone: '09187773310', municipality: 'Boac', barangay: 'Tumagabok', street: 'Near the barangay hall' },
];

const withPostal = (address, i) => {
  const town = getLocations().find((m) => m.name === address.municipality);
  // Stagger createdAt so "newest" and list order are stable.
  return { province: 'Marinduque', postalCode: town.postalCode, isDefault: false, customLabel: null, createdAt: new Date(Date.UTC(2026, 9, 1 + i)), ...address };
};

/** Addresses for Juana (3), Rodel the approved farmer (3) and each extra buyer (1, pinned inside its barangay). Users who already have addresses are skipped. */
export async function seedAddresses() {
  const users = await findUsersByUsernames(['buyer', 'farmer.approved', ...Array.from({ length: 20 }, (_, i) => `buyer${String(i + 1).padStart(2, '0')}`)]);
  const towns = getLocations();
  const docs = [];
  for (const user of users) {
    if ((await countActiveByUser(user._id)) > 0) continue;
    const fixed = { buyer: JUANA, 'farmer.approved': RODEL }[user.username];
    if (fixed) {
      docs.push(...fixed.map((a, i) => withPostal({ ...a, user: user._id }, i)));
      continue;
    }
    const n = Number(user.username.slice(5, 7));
    const town = towns[n % towns.length];
    const barangay = town.barangays[(n * 7) % town.barangays.length];
    const pin = labelPoint(town.name, barangay);
    docs.push(withPostal({
      user: user._id, label: 'Home', recipientName: `${user.firstName} ${user.lastName}`, phone: user.contactNumber ?? '09170000000',
      municipality: town.name, barangay, street: `Purok ${1 + (n % 6)}, near the barangay hall`,
      location: point(pin.lat, pin.lng), isDefault: true,
    }, n));
  }
  if (docs.length) await insertAddresses(docs);
  await syncAddressCounts(users.map((u) => u._id));
  return `${docs.length} addresses`;
}
