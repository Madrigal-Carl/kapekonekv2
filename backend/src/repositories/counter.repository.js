import { Counter } from '../models/counter.model.js';

/**
 * Atomically take the next number of a named sequence (starts at 1).
 * @param {string} key e.g. `order:20261124`
 * @returns {Promise<number>}
 */
export const nextSequence = async (key) =>
  (await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' }).lean()).seq;
