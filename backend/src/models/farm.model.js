import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;
const point = new mongoose.Schema({ type: { type: String, enum: ['Point'], required: true }, coordinates: { type: [Number], required: true } }, { _id: false });

const farmSchema = new mongoose.Schema(
  {
    propertyNumber: { type: String, required: true, unique: true }, // TCT-<year>-<NNNN>
    owner: { type: ObjectId, ref: 'User', required: true }, // the farmer, or the Kaluppa account for Kaluppa farms
    ownerType: { type: String, enum: ['farmer', 'kaluppa'], required: true },
    association: { type: ObjectId, ref: 'Association', default: null }, // the farmer's, or the managing Group Manager's
    managedBy: { type: ObjectId, ref: 'User', default: null }, // Kaluppa farms only
    assignedFarmers: [{ type: ObjectId, ref: 'User' }], // Kaluppa farms only
    sizeHa: { type: Number, required: true },
    municipality: { type: String, required: true },
    barangay: { type: String, required: true },
    street: { type: String, default: '' },
    location: { type: point, required: true }, // [lng, lat]
    createdBy: { type: ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
farmSchema.index({ location: '2dsphere' });
farmSchema.index({ association: 1, archivedAt: 1 });
farmSchema.index({ managedBy: 1 });

export const Farm = mongoose.models.Farm ?? mongoose.model('Farm', farmSchema);
