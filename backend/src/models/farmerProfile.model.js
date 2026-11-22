import mongoose from 'mongoose';

export const FARMER_STATUSES = ['none', 'pending', 'approved', 'rejected'];

const documentSchema = new mongoose.Schema(
  { url: String, publicId: String, name: String, bytes: Number, kind: { type: String, enum: ['image', 'pdf'] } },
  { _id: false },
);

const farmerProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    association: { type: mongoose.Schema.Types.ObjectId, ref: 'Association', default: null },
    status: { type: String, enum: FARMER_STATUSES, default: 'none' },
    rejectionReason: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    documents: { validId: { type: documentSchema, default: null }, landProof: { type: documentSchema, default: null } },
    transferRequest: {
      type: new mongoose.Schema({ association: { type: mongoose.Schema.Types.ObjectId, ref: 'Association' }, reason: String, requestedAt: Date }, { _id: false }),
      default: null,
    },
    history: [{ _id: false, action: String, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, at: { type: Date, default: Date.now }, note: String }],
  },
  { timestamps: true },
);
farmerProfileSchema.index({ association: 1, status: 1 });

export const FarmerProfile = mongoose.models.FarmerProfile ?? mongoose.model('FarmerProfile', farmerProfileSchema);
