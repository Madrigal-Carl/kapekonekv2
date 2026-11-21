import mongoose from 'mongoose';

export const TOKEN_PURPOSES = { VERIFY_EMAIL: 'verify_email', RESET_PASSWORD: 'reset_password' };

const tokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    purpose: { type: String, enum: Object.values(TOKEN_PURPOSES), required: true },
    tokenHash: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
tokenSchema.index({ user: 1, purpose: 1 });

export const Token = mongoose.models.Token ?? mongoose.model('Token', tokenSchema);
