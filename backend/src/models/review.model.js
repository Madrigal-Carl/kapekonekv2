import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reviewSchema = new mongoose.Schema(
  {
    product: { type: ObjectId, ref: 'Product', required: true },
    buyer: { type: ObjectId, ref: 'User', required: true },
    order: { type: ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, minlength: 10, maxlength: 1000 },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
reviewSchema.index({ product: 1, buyer: 1 }, { unique: true });
reviewSchema.index({ product: 1, createdAt: -1 });

export const Review = mongoose.models.Review ?? mongoose.model('Review', reviewSchema);
