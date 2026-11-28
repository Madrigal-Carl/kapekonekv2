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
    tags: { type: [String], default: [] },
    mentions: { type: [{ type: ObjectId, ref: 'User' }], default: [] }, // Change 08: @mentions (checked server-side)
    media: { type: [mediaSchema], default: [], validate: [(m) => m.length <= 10, 'At most 10 photos or videos'] },
    reactionCounts: { like: { type: Number, default: 0 }, love: { type: Number, default: 0 }, celebrate: { type: Number, default: 0 } },
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 }, // signed-in people, once a day each (PostView)
    editedAt: { type: Date, default: null },
    isPublished: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null }, // the author deleted it
    removedAt: { type: Date, default: null }, // Kaluppa removed it (posts.moderate)
    removedBy: { type: ObjectId, ref: 'User', default: null },
    removalReason: { type: String, default: null },
  },
  { timestamps: true },
);
postSchema.index({ isPublished: 1, deletedAt: 1, createdAt: -1 });
postSchema.index({ tags: 1, createdAt: -1 });

export const Post = mongoose.models.Post ?? mongoose.model('Post', postSchema);
