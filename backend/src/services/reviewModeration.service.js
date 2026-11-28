import { findProductIdsByName, findProductNames } from '../repositories/product.repository.js';
import * as repo from '../repositories/review.repository.js';
import { findUserIdsByName } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { containsPattern } from '../utils/escapeRegex.js';
import { record } from './audit.service.js';
import { notifyUsers } from './notification.service.js';
import { recomputeRating } from './review.service.js';

const notFound = () => new AppError(404, "We couldn't find that review.");
const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : 'Deleted account');

/** The moderation view of a review (Reviews.dc.html / ReviewView.dc.html). */
const present = (r) => ({
  id: String(r._id),
  rating: r.rating,
  comment: r.comment,
  createdAt: r.createdAt,
  editedAt: r.editedAt,
  product: r.product
    ? { id: String(r.product._id), name: r.product.name, slug: r.product.slug, image: r.product.images?.[0]?.url ?? null, variety: r.product.variety, coffeeType: r.product.coffeeType, unitLabel: r.product.unitLabel }
    : null,
  reviewer: r.buyer ? { id: String(r.buyer._id), name: fullName(r.buyer), role: r.buyer.roles.includes('farmer') ? 'farmer' : 'buyer' } : null,
  order: r.order ? { id: String(r.order._id), orderNumber: r.order.orderNumber } : null,
  reply: r.reply ? { body: r.reply.body, at: r.reply.at, editedAt: r.reply.editedAt, by: r.reply.by ? { firstName: r.reply.by.firstName, name: fullName(r.reply.by) } : null } : null,
  hidden: r.hiddenAt ? { at: r.hiddenAt, reason: r.hiddenReason, by: { name: fullName(r.hiddenBy) } } : null,
});
const entity = (r) => ({ type: 'review', id: r._id, label: `${r.rating}-star review of ${r.product?.name ?? 'a product'}` });

/**
 * Every review, one numbered page: Status, product, stars, reply state, and search over product, reviewer and text.
 * @param {{ status?: 'visible'|'hidden', product?: string, rating?: number, reply?: 'needs'|'replied', q: string, page: number, limit: number }} query
 */
export async function listAdminReviews({ status, product, rating, reply, q, page, limit }) {
  const filter = {};
  if (status) filter.hiddenAt = status === 'hidden' ? { $ne: null } : null;
  if (product) filter.product = product;
  if (rating) filter.rating = rating;
  if (reply) filter.reply = reply === 'needs' ? null : { $ne: null };
  if (q) {
    const pattern = containsPattern(q);
    const [productIds, reviewerIds] = await Promise.all([findProductIdsByName(pattern), findUserIdsByName(q.split(/\s+/).map(containsPattern))]);
    filter.$or = [{ comment: pattern }, { product: { $in: productIds } }, { buyer: { $in: reviewerIds } }];
  }
  const result = await repo.listReviewsPage(filter, { page, limit });
  return { items: result.items.map(present), meta: result.meta };
}

/** Products that have reviews, for the Product filter. */
export const listReviewedProducts = async () =>
  (await findProductNames(await repo.listReviewedProductIds())).map((p) => ({ id: String(p._id), name: p.name }));

async function findOr404(id) {
  const review = await repo.findReviewById(id);
  if (!review) throw notFound();
  return review;
}

export const getAdminReview = async (id) => present(await findOr404(id));

const tellReviewer = (review, title, body) =>
  review.buyer && notifyUsers([review.buyer._id], { type: 'review_activity', title, body, link: `/products/${review.product?.slug ?? ''}`, data: { reviewId: String(review._id) } });

/** Write or edit Kaluppa's one reply. The reviewer hears about the first one, not every edit. */
export async function saveReply(actor, id, { body }) {
  const before = await findOr404(id);
  const now = new Date();
  const reply = before.reply ? { ...before.reply, by: before.reply.by?._id, body, editedAt: now } : { body, by: actor._id, at: now, editedAt: null };
  const after = await repo.updateReviewById(id, { $set: { reply } });
  await record({ actor, area: 'reviews', action: before.reply ? 'update_reply' : 'reply', entity: entity(after), before: { reply: before.reply?.body ?? null }, after: { reply: body }, fields: ['reply'] });
  if (!before.reply) await tellReviewer(after, 'Kaluppa replied to your review', `On ${after.product?.name ?? 'a product'}: “${body.slice(0, 120)}”`);
  return present(after);
}

export async function deleteReply(actor, id) {
  const before = await findOr404(id);
  const after = await repo.updateReviewById(id, { $set: { reply: null } });
  await record({ actor, area: 'reviews', action: 'delete_reply', entity: entity(after), before: { reply: before.reply?.body ?? null }, after: { reply: null }, fields: ['reply'] });
  return present(after);
}

/** Hide (with a reason; the reviewer is told) or show again. Either way the product's rating is recounted. */
export async function setHidden(actor, id, hide, reason = null) {
  const before = await findOr404(id);
  const after = await repo.updateReviewById(id, { $set: hide ? { hiddenAt: new Date(), hiddenBy: actor._id, hiddenReason: reason } : { hiddenAt: null, hiddenBy: null, hiddenReason: null } });
  await recomputeRating(after.product._id);
  await record({
    actor, area: 'reviews', action: hide ? 'hide' : 'unhide', entity: entity(after),
    before: { hiddenReason: before.hiddenReason ?? null }, after: { hiddenReason: after.hiddenReason ?? null }, fields: ['hiddenReason'],
  });
  if (hide) await tellReviewer(after, 'Your review was hidden', `Your review of ${after.product?.name ?? 'a product'} was hidden. Reason: ${reason}`);
  return present(after);
}

