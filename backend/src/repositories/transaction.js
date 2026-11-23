import mongoose from 'mongoose';

/**
 * Run `work(session)` in a MongoDB transaction; transient conflicts are retried, a thrown error aborts it.
 * Needs a replica set (Atlas, or a local single-node replica set).
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} work
 * @returns {Promise<T>}
 */
export const inTransaction = (work) => mongoose.connection.transaction(work);
