import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    post: { type: ObjectId, ref: 'Post', required: true },
    author: { type: ObjectId, ref: 'User', required: true },
    parent: { type: ObjectId, ref: 'PostComment', default: null }, // one level of replies
    body: { type: String, required: true },
    reactionCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);
commentSchema.index({ post: 1, parent: 1, createdAt: 1 });
commentSchema.index({ parent: 1, createdAt: 1 });

export const PostComment = mongoose.models.PostComment ?? mongoose.model('PostComment', commentSchema);
