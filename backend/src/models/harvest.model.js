import mongoose from 'mongoose';
import { VARIETIES } from '../constants/catalog.js';

const { ObjectId } = mongoose.Schema.Types;

const harvestSchema = new mongoose.Schema(
  {
    farm: { type: ObjectId, ref: 'Farm', required: true },
    owner: { type: ObjectId, ref: 'User', required: true }, // copied from the farm
    association: { type: ObjectId, ref: 'Association', default: null }, // copied from the farm, follows it
    variety: { type: String, enum: Object.keys(VARIETIES), required: true },
    yieldKg: { type: Number, required: true },
    harvestedAt: { type: Date, required: true },
    note: { type: String, default: '' },
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
harvestSchema.index({ farm: 1, archivedAt: 1, harvestedAt: -1 });
harvestSchema.index({ association: 1, harvestedAt: -1 });

export const Harvest = mongoose.models.Harvest ?? mongoose.model('Harvest', harvestSchema);
