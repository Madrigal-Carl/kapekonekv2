import mongoose from 'mongoose';

const associationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true }, // unique slug = names unique regardless of case
    municipality: { type: String, required: true },
    description: { type: String, default: '' },
    groupManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    groupChat: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// One association per Group Manager.
associationSchema.index({ groupManager: 1 }, { unique: true, partialFilterExpression: { groupManager: { $type: 'objectId' } } });

export const Association = mongoose.models.Association ?? mongoose.model('Association', associationSchema);
