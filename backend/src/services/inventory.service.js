import { categoryIdsBySlug } from '../repositories/category.repository.js';
import * as repo from '../repositories/product.repository.js';
import { AppError } from '../utils/AppError.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { slugify } from './association.service.js';
import { record } from './audit.service.js';
import { fieldError } from './farmerProfile.service.js';
import { assertUploadAllowed, isOwnUpload } from './upload.service.js';

const AUDITED = ['name', 'category', 'variety', 'coffeeType', 'unit', 'priceCentavos', 'stock', 'description', 'photos', 'thumbnail', 'isFeatured', 'isActive'];
const notFound = () => new AppError(404, 'Product not found.');
/** Low-stock line: 10, or 50 for seedlings (PHASE-2-SPEC §4). */
const lowLine = (categorySlug) => (categorySlug === 'seedlings' ? 50 : 10);
const stockState = (p) => (p.stock <= 0 ? 'out' : p.stock < lowLine(p.category?.slug) ? 'low' : 'in');

/** The Inventory view of a product: stored `images` are the form's `photos`, thumbnail first. */
const present = (p) => ({
  _id: p._id,
  name: p.name,
  slug: p.slug,
  category: p.category ? { slug: p.category.slug, name: p.category.name } : null,
  variety: p.variety,
  coffeeType: p.coffeeType,
  unit: p.unit,
  unitLabel: p.unitLabel,
  priceCentavos: p.priceCentavos,
  stock: p.stock,
  stockState: stockState(p),
  description: p.description,
  photos: p.images.map(({ url, publicId, isThumbnail }, i) => ({ url, publicId, isThumbnail: Boolean(isThumbnail) || (i === 0 && !p.images.some((x) => x.isThumbnail)) })),
  isFeatured: p.isFeatured,
  isActive: p.isActive,
  archivedAt: p.archivedAt ?? null,
  createdAt: p.createdAt,
});
const auditView = (p) => ({ ...Object.fromEntries(AUDITED.map((k) => [k, p[k] ?? null])), category: p.category?.slug ?? null, photos: p.photos.map((x) => x.publicId), thumbnail: `photo ${p.photos.findIndex((x) => x.isThumbnail) + 1}` });
const entity = (p) => ({ type: 'product', id: p._id, label: p.name });

/** Mongo filter for one stock state; the low line differs for seedlings. */
function stockFilter(state, seedlingsId) {
  const below = (line) => ({ $gt: 0, $lt: line });
  if (state === 'out') return { stock: { $lte: 0 } };
  if (state === 'low') return { $or: [{ category: seedlingsId, stock: below(50) }, { category: { $ne: seedlingsId }, stock: below(10) }] };
  return { $or: [{ category: seedlingsId, stock: { $gte: 50 } }, { category: { $ne: seedlingsId }, stock: { $gte: 10 } }] };
}

/**
 * The Inventory table (PHASE-2-SPEC §4): Status, category, stock state, name search; numbered pages.
 * @param {{ status: 'active'|'inactive'|'archived', category?: string, stock?: 'low'|'out'|'in', q: string, page: number, limit: number }} query
 */
export async function listInventory({ status, category, stock, q, page, limit }) {
  const ids = await categoryIdsBySlug();
  const and = [status === 'archived' ? { archivedAt: { $ne: null } } : { archivedAt: null, isActive: status === 'active' }];
  if (category) and.push({ category: ids[category] });
  if (stock) and.push(stockFilter(stock, ids.seedlings));
  if (q) and.push({ name: new RegExp(escapeRegex(q), 'i') });
  const result = await repo.listInventoryPage({ $and: and }, { page, limit });
  return { items: result.items.map(present), meta: result.meta };
}

/** @param {string} id */
export async function getInventoryProduct(id) {
  const product = await repo.findProductById(id);
  if (!product) throw notFound();
  return present(product);
}

/**
 * Photos as stored: new ones must come from the actor's own `product_photo` folder (re-checked on Cloudinary),
 * ones already on the product stay. Exactly one thumbnail, stored first so cards, the cart and order snapshots use it.
 */
async function imagesFor(actor, photos, existing = []) {
  const kept = new Set(existing.map((p) => p.publicId));
  for (const photo of photos) {
    if (kept.has(photo.publicId)) continue;
    if (!isOwnUpload(actor, 'product_photo', photo)) throw fieldError('photos', 'Upload these photos again.');
    await assertUploadAllowed('product_photo', photo.publicId, 'photos');
  }
  const thumb = Math.max(0, photos.findIndex((p) => p.isThumbnail));
  return [photos[thumb], ...photos.filter((_, i) => i !== thumb)].map(({ url, publicId }, i) => ({ url, publicId, isThumbnail: i === 0 }));
}

/** Form fields → stored fields (category id, no variety/coffee type the category lacks, the 250 g pack label). */
async function storedFields(actor, { category, photos, variety, coffeeType, description, ...fields }, before) {
  const ids = await categoryIdsBySlug();
  const unitLabel = fields.unit === before?.unit ? before.unitLabel : fields.unit === 'pack' ? '250 g' : null;
  return {
    ...fields,
    category: ids[category],
    variety: category === 'fertilizer' ? null : variety,
    coffeeType: category === 'coffee' ? coffeeType : null,
    description,
    // shortcut: the card line is the description's start; a separate field when Kaluppa asks for one.
    shortDescription: description.length > 140 ? `${description.slice(0, 139).trimEnd()}…` : description,
    unitLabel,
    images: await imagesFor(actor, photos, before?.images),
  };
}

async function uniqueSlug(name) {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let n = 2; await repo.slugTaken(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/** Add a product (Kaluppa). @param {object} actor @param {object} input productSchema output */
export async function createInventoryProduct(actor, input) {
  const product = await repo.createProduct({ ...(await storedFields(actor, input)), slug: await uniqueSlug(input.name) });
  const view = present(product);
  await record({ actor, area: 'inventory', action: 'create', entity: entity(view), after: auditView(view), fields: AUDITED });
  return view;
}

/** Edit a product. The slug stays, so shared links keep working after a rename. */
export async function updateInventoryProduct(actor, id, input) {
  const before = await repo.findProductById(id);
  if (!before) throw notFound();
  const after = present(await repo.updateProduct(id, await storedFields(actor, input, before)));
  const was = present(before);
  await record({ actor, area: 'inventory', action: 'update', entity: entity(after), before: auditView(was), after: auditView(after), fields: AUDITED });
  return after;
}

/** Archive (soft delete: it leaves the store and the list) or restore. */
export async function setArchived(actor, id, archived) {
  const before = await repo.findProductById(id);
  if (!before) throw notFound();
  const after = present(await repo.updateProduct(id, { archivedAt: archived ? new Date() : null }));
  await record({
    actor, area: 'inventory', action: archived ? 'archive' : 'restore', entity: entity(after),
    before: { archivedAt: before.archivedAt ?? null }, after: { archivedAt: after.archivedAt }, fields: ['archivedAt'],
  });
  return after;
}
