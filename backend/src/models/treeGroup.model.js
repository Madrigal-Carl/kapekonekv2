import mongoose from 'mongoose';
import { VARIETIES } from '../constants/catalog.js';
import { TREE_STAGES } from '../constants/records.js';

const { ObjectId } = mongoose.Schema.Types;

const treeGroupSchema = new mongoose.Schema(
  {
    farm: { type: ObjectId, ref: 'Farm', required: true },
    owner: { type: ObjectId, ref: 'User', required: true }, // copied from the farm
    association: { type: ObjectId, ref: 'Association', default: null }, // copied from the farm, follows it
    variety: { type: String, enum: Object.keys(VARIETIES), required: true },
    count: { type: Number, required: true },
    stage: { type: String, enum: TREE_STAGES, required: true },
    plantedAt: { type: Date, required: true },
    note: { type: String, default: '' },
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date, default: null }, // equal to the farm's archivedAt when archived with it
  },
  { timestamps: true },
);
treeGroupSchema.index({ farm: 1, archivedAt: 1 });
treeGroupSchema.index({ association: 1, archivedAt: 1 });

export const TreeGroup = mongoose.models.TreeGroup ?? mongoose.model('TreeGroup', treeGroupSchema);
