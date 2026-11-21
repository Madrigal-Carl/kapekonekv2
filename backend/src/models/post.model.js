import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const mediaSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['image', 'video'], required: true },
    url: { type: String, required: true },
    publicId: String,
    width: Number,
    height: Number,
    durationSec: Number,
    posterUrl: String,
    alt: String,
  },
  { _id: false },
);

const postSchema = new mongoose.Schema(
  {
    author: { type: ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    media: { type: [mediaSchema], default: [], validate: [(m) => m.length <= 10, 'At most 10 photos or videos'] },
    reactionCounts: { like: { type: Number, default: 0 }, love: { type: Number, default: 0 }, celebrate: { type: Number, default: 0 } },
    commentCount: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
postSchema.index({ isPublished: 1, deletedAt: 1, createdAt: -1 });

export const Post = mongoose.models.Post ?? mongoose.model('Post', postSchema);
