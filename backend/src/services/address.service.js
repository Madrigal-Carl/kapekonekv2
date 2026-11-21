import {
  countActiveByUser, createAddress as insertAddress, findActiveForUser, findNewestActive, listActiveByUser,
  setDefaultForUser, softDeleteForUser, updateAddressForUser,
} from '../repositories/address.repository.js';
import { AppError } from '../utils/AppError.js';
import { quoteForAddress } from './deliveryQuote.service.js';
import { getLocations } from './location.service.js';

export const MAX_ADDRESSES = 10;
const notFound = () => new AppError(404, "We couldn't find that address.");

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
 * The user's active addresses (default first), each with `pinned` and its delivery quote when quotable.
 * @param {{ _id: unknown }} user
 */
export async function listAddresses(user) {
  return Promise.all((await listActiveByUser(user._id)).map(withQuote));
}

/** @param {{ _id: unknown }} user */
export async function createAddress(user, body) {
  const count = await countActiveByUser(user._id);
  if (count >= MAX_ADDRESSES) throw new AppError(409, `You can save up to ${MAX_ADDRESSES} addresses`);
  const address = await insertAddress({ ...toDoc(body), user: user._id, isDefault: count === 0 });
  if (body.isDefault && count > 0) return presentAddress(await setDefaultForUser(address._id, user._id));
  return presentAddress(address);
}

/** @param {{ _id: unknown }} user */
export async function updateAddress(user, id, body) {
  const address = await updateAddressForUser(id, user._id, toDoc(body));
  if (!address) throw notFound();
  if (body.isDefault && !address.isDefault) return presentAddress(await setDefaultForUser(id, user._id));
  return presentAddress(address);
}

/** Soft delete; when it was the default, the newest remaining address becomes the default. */
export async function deleteAddress(user, id) {
  const deleted = await softDeleteForUser(id, user._id);
  if (!deleted) throw notFound();
  if (deleted.isDefault) {
    const newest = await findNewestActive(user._id);
    if (newest) await setDefaultForUser(newest._id, user._id);
  }
}

export async function setDefault(user, id) {
  const address = await setDefaultForUser(id, user._id);
  if (!address) throw notFound();
  return presentAddress(address);
}

/** One of the user's active addresses (raw, with its GeoJSON location), else 404. */
export async function getOwnAddress(user, id) {
  const address = await findActiveForUser(id, user._id);
  if (!address) throw notFound();
  return address;
}

export const quoteForOwnAddress = async (user, id) => quoteForAddress(await getOwnAddress(user, id));
