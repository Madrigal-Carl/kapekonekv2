import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    group: { type: String, required: true },
  },
  { timestamps: true },
);

export const Permission = mongoose.models.Permission ?? mongoose.model('Permission', permissionSchema);
