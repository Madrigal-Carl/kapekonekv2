import mongoose from 'mongoose';
import { env } from './env.js';

/** Connect Mongoose. Throws if the server is unreachable. */
export const connectDb = (uri = env.MONGO_URI) => mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

export const disconnectDb = () => mongoose.disconnect();

export const isDbConnected = () => mongoose.connection.readyState === 1;
