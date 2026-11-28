import {
  claimAddressBookChange, createAddress as insertAddress, findActiveForUser, findAddressBook, findNewestActive, listActiveByUser,
  setDefaultForUser, softDeleteForUser, updateAddressForUser,
} from '../repositories/address.repository.js';
import { AppError } from '../utils/AppError.js';
import { quoteForAddress } from './deliveryQuote.service.js';
import { userCan } from './permission.service.js';
import { getLocations } from './location.service.js';

export const MAX_ADDRESSES = 10;
const notFound = () => new AppError(404, "We couldn't find that address.");
const changedElsewhere = () => new AppError(409, 'Your addresses changed in another tab. Refresh and try again.', { code: 'ADDRESSES_CHANGED' });

/**
 * Claim one change to the address book (Change 08): the version the page started from must still be current, and an
 * add must find fewer than 10 saved. Both are checked in a single conditional update, so parallel requests can't
 * pass together.
 * @param {number|undefined} version from `If-Match`; undefined skips the version check
 */
async function claimChange(user, version, delta = 0) {
  const book = await claimAddressBookChange(user._id, { version, delta, max: delta > 0 ? MAX_ADDRESSES : undefined });
  if (book) return book;
  const now = await findAddressBook(user._id);
  if (delta > 0 && now.addressCount >= MAX_ADDRESSES) throw new AppError(409, `You can have up to ${MAX_ADDRESSES} addresses.`, { code: 'CONFLICT' });
  throw changedElsewhere();
}

/** Body `{ lat, lng }` → GeoJSON Point, and the derived province and postal code. */
const toDoc = ({ location, isDefault: _ignored, ...fields }) => ({
  ...fields,
  customLabel: fields.label === 'Other' ? fields.customLabel : null,
  province: 'Marinduque',
  postalCode: getLocations().find((m) => m.name === fields.municipality).postalCode,
  location: location ? { type: 'Point', coordinates: [location.lng, location.lat] } : undefined,
});

/** API shape: `location` as `{ lat, lng }` or null, plus `pinned`. */
export function presentAddress({ user: _user, deletedAt: _deleted, location, ...address }) {
  const [lng, lat] = location?.coordinates ?? [];
  return { ...address, location: location ? { lat, lng } : null, pinned: Boolean(location) };
}

/** A quote, or `quoteError` with the 422 code (e.g. ADDRESS_NEEDS_PIN) when it can't be quoted. */
async function withQuote(address) {
  try {
    return { ...presentAddress(address), quote: await quoteForAddress(address), quoteError: null };
  } catch (error) {
    if (error.statusCode !== 422) throw error;
    return { ...presentAddress(address), quote: null, quoteError: error.code };
  }
}

/**
 * The user's active addresses (default first), each with `pinned` and its delivery quote when quotable, and the
 * address book version the page sends back with its next change.
 * @param {{ _id: unknown }} user
 */
export async function listAddresses(user) {
  const [items, book] = await Promise.all([listActiveByUser(user._id).then((list) => Promise.all(list.map(withQuote))), findAddressBook(user._id)]);
  return { items, version: book?.addressesVersion ?? 0 };
}

/** The Farm label is for people who keep farms (farmers), not buyers. */
async function assertLabelAllowed(user, { label }) {
  if (label === 'Farm' && !(await userCan(user, 'farms.manage'))) {
    throw new AppError(400, 'Please check the highlighted fields.', { code: 'VALIDATION_ERROR', errors: { label: 'Choose Home, Work or Other' } });
  }
}

/**
 * @param {{ _id: unknown }} user
 * @param {number} [version] the address book version the page started from (`If-Match`)
 * @returns {Promise<{ address: object, version: number }>}
 */
export async function createAddress(user, body, version) {
  await assertLabelAllowed(user, body);
  const book = await claimChange(user, version, 1);
  const first = book.addressCount === 1;
  let address;
  try {
    address = await insertAddress({ ...toDoc(body), user: user._id, isDefault: first });
  } catch (error) {
    await claimAddressBookChange(user._id, { delta: -1 }); // give the slot back
    throw error;
  }
  if (body.isDefault && !first) address = await setDefaultForUser(address._id, user._id);
  return { address: presentAddress(address), version: book.addressesVersion };
}

/** @param {{ _id: unknown }} user @param {number} [version] */
export async function updateAddress(user, id, body, version) {
  await assertLabelAllowed(user, body);
  await getOwnAddress(user, id);
  const book = await claimChange(user, version);
  let address = await updateAddressForUser(id, user._id, toDoc(body));
  if (!address) throw notFound();
  if (body.isDefault && !address.isDefault) address = await setDefaultForUser(id, user._id);
  return { address: presentAddress(address), version: book.addressesVersion };
}

/** Soft delete; when it was the default, the newest remaining address becomes the default. */
export async function deleteAddress(user, id, version) {
  await getOwnAddress(user, id);
  const book = await claimChange(user, version, -1);
  const deleted = await softDeleteForUser(id, user._id);
  if (!deleted) throw notFound();
  if (deleted.isDefault) {
    const newest = await findNewestActive(user._id);
    if (newest) await setDefaultForUser(newest._id, user._id);
  }
  return { version: book.addressesVersion };
}

export async function setDefault(user, id, version) {
  await getOwnAddress(user, id);
  const book = await claimChange(user, version);
  const address = await setDefaultForUser(id, user._id);
  if (!address) throw notFound();
  return { address: presentAddress(address), version: book.addressesVersion };
}

/** One of the user's active addresses (raw, with its GeoJSON location), else 404. */
export async function getOwnAddress(user, id) {
  const address = await findActiveForUser(id, user._id);
  if (!address) throw notFound();
  return address;
}

export const quoteForOwnAddress = async (user, id) => quoteForAddress(await getOwnAddress(user, id));
