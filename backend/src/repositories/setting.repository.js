import { Setting } from '../models/setting.model.js';

/** @returns {Promise<unknown|undefined>} the stored value, or undefined when the key was never saved */
export const findSettingValue = async (key) => (await Setting.findOne({ key }).lean())?.value;

/**
 * Insert settings that don't exist yet; existing values (possibly edited by Kaluppa) are kept.
 * @param {Record<string, unknown>} values key → value
 */
export const insertMissingSettings = (values) =>
  Setting.bulkWrite(Object.entries(values).map(([key, value]) => ({
    updateOne: { filter: { key }, update: { $setOnInsert: { key, value } }, upsert: true },
  })));

/** Replace one setting's value (seeder, for data such as hero slides that depend on uploaded media). */
export const replaceSetting = (key, value) => Setting.updateOne({ key }, { $set: { value } }, { upsert: true });

export const countSettings = () => Setting.countDocuments();

/** Save one setting (Kaluppa's Settings page). @returns {Promise<{ _id: unknown, key: string, value: unknown }>} */
export const saveSetting = (key, value) => Setting.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true, returnDocument: 'after' }).lean();
