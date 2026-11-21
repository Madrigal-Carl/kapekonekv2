import mongoose from 'mongoose';
import { ADDRESS_LABELS } from '../constants/geo.js';

const point = new mongoose.Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, enum: ADDRESS_LABELS, required: true },
    customLabel: { type: String, default: null },
    recipientName: { type: String, required: true },
    phone: { type: String, required: true },
    province: { type: String, default: 'Marinduque' },
    municipality: { type: String, required: true },
    barangay: { type: String, required: true },
    street: { type: String, required: true },
    postalCode: { type: String, required: true },
    location: { type: point, default: undefined }, // [lng, lat]; absent when the buyer didn't drop a pin
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
addressSchema.index({ user: 1, deletedAt: 1 });
addressSchema.index({ location: '2dsphere' });

export const Address = mongoose.models.Address ?? mongoose.model('Address', addressSchema);
