import mongoose from 'mongoose';
import { COFFEE_TYPES, UNITS, VARIETIES } from '../constants/catalog.js';
import {
  EWALLET_PROVIDERS, FULFILLMENT_METHODS, ORDER_STATUSES, PAYMENT_METHODS, REFUND_STATUSES,
} from '../constants/orderStatus.js';

const { ObjectId } = mongoose.Schema.Types;
const opts = { _id: false };
const point = new mongoose.Schema({ type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: [Number] }, opts);

const itemSchema = new mongoose.Schema(
  {
    product: { type: ObjectId, ref: 'Product', required: true },
    name: String,
    slug: String,
    image: String,
    variety: { type: String, enum: [...Object.keys(VARIETIES), null], default: null },
    coffeeType: { type: String, enum: [...Object.keys(COFFEE_TYPES), null], default: null },
    unit: { type: String, enum: UNITS },
    unitLabel: String,
    priceCentavos: Number,
    quantity: Number,
    lineTotalCentavos: Number,
  },
  opts,
);

const addressSnapshot = new mongoose.Schema(
  {
    label: String, customLabel: String, recipientName: String, phone: String, province: String,
    municipality: String, barangay: String, street: String, postalCode: String, location: point,
  },
  opts,
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: ObjectId, ref: 'User', default: null },
    byRole: String, // role slug, or "system" for the expiry scheduler
    reasonCode: String,
    reason: String,
    note: String,
  },
  opts,
);

const reasonSchema = new mongoose.Schema({ by: { type: ObjectId, ref: 'User' }, reasonCode: String, reason: String, at: Date }, opts);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    buyer: { type: ObjectId, ref: 'User', required: true },
    items: { type: [itemSchema], required: true },
    subtotalCentavos: { type: Number, required: true },
    deliveryFeeCentavos: { type: Number, default: 0 },
    totalCentavos: { type: Number, required: true },
    fulfillment: {
      method: { type: String, enum: FULFILLMENT_METHODS, required: true },
      contactName: String,
      contactPhone: String,
      address: addressSnapshot,
      distanceKm: Number,
      distanceSource: { type: String, enum: ['mapbox', 'fallback'] },
      pickup: { name: String, address: String, hours: String, location: { lat: Number, lng: Number } },
      rider: { name: String, phone: String },
      etaFrom: Date,
      etaTo: Date,
    },
    payment: {
      method: { type: String, enum: PAYMENT_METHODS, required: true },
      provider: { type: String, enum: [...EWALLET_PROVIDERS, null], default: null },
      receipt: { url: String, publicId: String },
      submittedAt: Date,
      verifiedAt: Date,
      verifiedBy: { type: ObjectId, ref: 'User' },
      cashCollectedAt: Date,
    },
    note: { type: String, default: null },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: { type: [historySchema], default: [] },
    cancellation: reasonSchema,
    rejection: reasonSchema,
    expiredAt: Date,
    stockReserved: { type: Boolean, default: false },
    refund: {
      status: { type: String, enum: REFUND_STATUSES, default: 'not_applicable' },
      referenceNumber: String,
      refundedAt: Date,
      refundedBy: { type: ObjectId, ref: 'User' },
    },
  },
  { timestamps: true },
);
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ buyer: 1, status: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order = mongoose.models.Order ?? mongoose.model('Order', orderSchema);
