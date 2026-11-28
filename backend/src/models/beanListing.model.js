import mongoose from 'mongoose';
import { VARIETIES } from '../constants/catalog.js';
import { BEAN_FORMS, BEAN_STATUSES } from '../constants/beans.js';

const { ObjectId } = mongoose.Schema.Types;
const photoSchema = new mongoose.Schema({ url: String, publicId: String }, { _id: false });
const decisionSchema = (extra = {}) => new mongoose.Schema({ reason: String, at: Date, by: { type: ObjectId, ref: 'User' }, ...extra }, { _id: false });

const beanListingSchema = new mongoose.Schema(
  {
    listingNumber: { type: String, required: true, unique: true },
    farmer: { type: ObjectId, ref: 'User', required: true },
    association: { type: ObjectId, ref: 'Association', default: null }, // snapshot at listing time
    recordedBy: { type: ObjectId, ref: 'User', required: true },
    variety: { type: String, enum: Object.keys(VARIETIES), required: true },
    form: { type: String, enum: Object.keys(BEAN_FORMS), required: true },
    weightKg: { type: Number, required: true },
    pricePerKgCentavos: { type: Number, required: true },
    photos: { type: [photoSchema], default: [] },
    note: { type: String, default: '' },
    status: { type: String, enum: BEAN_STATUSES, default: 'pending' },
    countsTowardCap: { type: Boolean, required: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null },
    completion: { type: new mongoose.Schema({ finalWeightKg: Number, finalAmountCentavos: Number, at: Date, by: { type: ObjectId, ref: 'User' } }, { _id: false }), default: null },
    rejection: { type: decisionSchema(), default: null },
    cancellation: { type: decisionSchema({ byRole: String }), default: null },
    history: [{ _id: false, action: String, at: { type: Date, default: Date.now }, by: { type: ObjectId, ref: 'User', default: null }, byRole: String, note: String }],
  },
  { timestamps: true },
);
beanListingSchema.index({ farmer: 1, status: 1 });
beanListingSchema.index({ association: 1, createdAt: -1 });
beanListingSchema.index({ status: 1, expiresAt: 1 });

export const BeanListing = mongoose.models.BeanListing ?? mongoose.model('BeanListing', beanListingSchema);
