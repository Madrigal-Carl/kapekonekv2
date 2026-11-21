import mongoose from 'mongoose';
import { COFFEE_TYPES, UNITS, VARIETIES } from '../constants/catalog.js';

const imageSchema = new mongoose.Schema({ url: { type: String, required: true }, publicId: String, alt: String }, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    variety: { type: String, enum: [...Object.keys(VARIETIES), null], default: null },
    coffeeType: { type: String, enum: [...Object.keys(COFFEE_TYPES), null], default: null },
    shortDescription: { type: String, maxlength: 140, default: '' },
    description: { type: String, default: '' },
    images: { type: [imageSchema], default: [] },
    priceCentavos: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    unitLabel: { type: String, default: null },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    ratingAverage: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
productSchema.index({ name: 'text', shortDescription: 'text' });
productSchema.index({ category: 1, isActive: 1, createdAt: -1 });
productSchema.index({ priceCentavos: 1 });
productSchema.index({ ratingAverage: 1 });

export const Product = mongoose.models.Product ?? mongoose.model('Product', productSchema);
