import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';
import { hashToken, randomToken } from '../utils/tokens.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    password: { type: String, required: [true, 'Password is required'], select: false },
    avatar: {
      public_id: { type: String, default: '' },
      url: { type: String, default: '' },
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wishlist: [{ type: mongoose.Schema.ObjectId, ref: 'Product' }],
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

const hideSecrets = (doc, ret) => {
  delete ret.password;
  delete ret.resetPasswordToken;
  delete ret.resetPasswordExpires;
  delete ret.emailVerificationToken;
  delete ret.emailVerificationExpires;
  delete ret.__v;
  return ret;
};
userSchema.set('toJSON', { transform: hideSecrets });
userSchema.set('toObject', { transform: hideSecrets });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcryptjs.hash(this.password, 10);
});

userSchema.methods.isPasswordMatch = function (candidate) {
  return bcryptjs.compare(String(candidate ?? ''), this.password);
};

// Both token helpers store only a hash and return the raw token for the email link
userSchema.methods.generatePasswordResetToken = function () {
  const token = randomToken(20);
  this.resetPasswordToken = hashToken(token);
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
  return token;
};

userSchema.methods.generateEmailVerificationToken = function () {
  const token = randomToken(20);
  this.emailVerificationToken = hashToken(token);
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return token;
};

export default mongoose.model('User', userSchema);
