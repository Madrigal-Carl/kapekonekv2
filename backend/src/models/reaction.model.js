import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const reactionSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    target: { type: ObjectId, required: true },
    user: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'love', 'celebrate'], required: true },
  },
  { timestamps: true },
);
reactionSchema.index({ targetType: 1, target: 1, user: 1 }, { unique: true });

export const Reaction = mongoose.models.Reaction ?? mongoose.model('Reaction', reactionSchema);
