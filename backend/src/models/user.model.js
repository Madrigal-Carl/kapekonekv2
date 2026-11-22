import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

export const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: null },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    roles: { type: [String], default: [] }, // role slugs
    permissions: { type: [String], default: [] }, // direct permission slugs
    contactNumber: { type: String, default: null },
    avatar: { url: String, publicId: String },
    tokenVersion: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
    isSeed: { type: Boolean, default: false }, // the mail worker skips these unless SEED_EMAIL_BASE is set
  },
  { timestamps: true },
);

userSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
});

userSchema.virtual('initials').get(function initials() {
  return `${this.firstName?.[0] ?? ''}${this.lastName?.[0] ?? ''}`.toUpperCase();
});

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, BCRYPT_ROUNDS);
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.password);
};

export const User = mongoose.models.User ?? mongoose.model('User', userSchema);
