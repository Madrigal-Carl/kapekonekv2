import mongoose from 'mongoose';

const point = new mongoose.Schema({ type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } }, { _id: false });

const associationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true }, // unique slug = names unique regardless of case
    municipality: { type: String, required: true },
    description: { type: String, default: '' },
    location: { type: point, default: null }, // meeting point [lng, lat]; null = the town's centre (Change 08)
    groupManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    groupChat: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', default: null },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// One association per Group Manager.
associationSchema.index({ groupManager: 1 }, { unique: true, partialFilterExpression: { groupManager: { $type: 'objectId' } } });

export const Association = mongoose.models.Association ?? mongoose.model('Association', associationSchema);
