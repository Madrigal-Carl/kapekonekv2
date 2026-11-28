import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

/** One signed-in person seeing a post on one Manila day (PHASE-2-SPEC §3.10). Guests aren't counted. */
const postViewSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: 'Post', required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    day: { type: String, required: true }, // YYYYMMDD, Asia/Manila
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
postViewSchema.index({ post: 1, user: 1, day: 1 }, { unique: true });
postViewSchema.index({ day: 1, post: 1 });

export const PostView = mongoose.models.PostView ?? mongoose.model('PostView', postViewSchema);
