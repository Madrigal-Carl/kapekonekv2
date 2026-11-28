import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

export const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true, default: null },
    lastName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional only for farmers a Group Manager creates (they sign in by username); the services require it otherwise.
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    roles: { type: [String], default: [] }, // role slugs
    permissions: { type: [String], default: [] }, // direct permission slugs
    contactNumber: { type: String, default: null },
    avatar: { url: String, publicId: String },
    tokenVersion: { type: Number, default: 0 },
    addressCount: { type: Number, default: 0 }, // active addresses; adding checks it in the same update (Change 08)
    addressesVersion: { type: Number, default: 0 }, // bumped by every address change; a stale tab's change is refused
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    lastLoginAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false }, // first sign-in goes to "Set a new password"
    termsVersion: { type: Number, default: 0 }, // Change 09: the Terms and Conditions version the user agreed to (0 = never)
    termsAcceptedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Kaluppa or a Group Manager: verify the email first
    passwordIsDefault: { type: Boolean, default: false }, // still KapeKonek@123: the dashboard suggests changing it
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
