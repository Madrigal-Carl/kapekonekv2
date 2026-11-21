import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    purchasePermission: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    hasVariety: { type: Boolean, default: false },
    hasCoffeeType: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Category = mongoose.models.Category ?? mongoose.model('Category', categorySchema);
