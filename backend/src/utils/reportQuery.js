import mongoose from 'mongoose';

/**
 * A Reports scope as a `$match` on the record's `association` (aggregations don't cast ids):
 * `undefined` every association, `null` nothing (a Group Manager without one), or one association id.
 * `exceptFarms` leaves those farms' records out (`farmKey` is the farm id's field: `farm`, or `_id` on farms).
 */
export const associationMatch = (association, exceptFarms, farmKey = 'farm') => ({
  ...(association === undefined ? {} : association === null ? { _id: null } : { association: new mongoose.Types.ObjectId(String(association)) }),
  ...(exceptFarms?.length && { [farmKey]: { $nin: exceptFarms } }),
});

/** "YYYY-MM" of a date field in Manila (matches `reportRange().keys`). */
export const manilaMonth = (date) => ({ $dateToString: { format: '%Y-%m', date, timezone: 'Asia/Manila' } });

/** Group key: "kaluppa" for Kaluppa farms' records, else the given field (association or owner). */
export const groupOrKaluppa = (field, kaluppaFarmIds) => ({ $cond: [{ $in: ['$farm', kaluppaFarmIds] }, 'kaluppa', `$${field}`] });
