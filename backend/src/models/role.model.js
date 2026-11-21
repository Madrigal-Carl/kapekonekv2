import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    permissions: { type: [String], default: [] }, // permission slugs
  },
  { timestamps: true },
);

export const Role = mongoose.models.Role ?? mongoose.model('Role', roleSchema);
